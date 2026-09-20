import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1.7.0";
import { PDFDocument } from "npm:@cantoo/pdf-lib@2.11.0";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MIN_PDF_BYTES = 256 * 1024;
const TMP_BUCKET = "pdf-compression-tmp";
const ENGINE = "cantoo-pdf-lib-structural-v1";
const allowedBuckets = new Set(["homework", "materials"]);
const allowedProfiles = new Set(["recommended", "extreme", "less"]);

type AdminClient = any;

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const isPdfPath = (path: string) => /\.pdf$/i.test(path);

async function getObjectState(admin: AdminClient, bucket: string, path: string) {
  const { data, error } = await admin
    .schema("storage")
    .from("objects")
    .select("updated_at,owner_id,metadata")
    .eq("bucket_id", bucket)
    .eq("name", path)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function updateMetadata(admin: AdminClient, bucket: string, path: string, size: number) {
  const table = bucket === "homework" ? "homework" : "materials";
  const { error } = await admin
    .from(table)
    .update({ file_size: size, mime_type: "application/pdf" })
    .eq("storage_path", path);
  if (error) console.error("pdf-compression metadata update:", error.message);
}

async function markJob(
  admin: AdminClient,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await admin
    .from("pdf_compression_jobs")
    .update(patch)
    .eq("id", jobId);
  if (error) throw error;
}

async function claimJob(admin: AdminClient, jobId: string) {
  const workerId = Deno.env.get("SB_EXECUTION_ID") || crypto.randomUUID();
  const { data, error } = await admin
    .from("pdf_compression_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      worker_id: workerId,
      attempt_count: 1,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id,tenant_id,source_bucket,source_path,profile,attempt_count")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function processJob(admin: AdminClient, jobId: string) {
  const job = await claimJob(admin, jobId);
  if (!job) return { status: "not-claimed", jobId };

  const tempRoot = `${job.tenant_id}/${job.id}`;
  const inputTempPath = `${tempRoot}/input.pdf`;
  const outputTempPath = `${tempRoot}/output.pdf`;

  try {
    if (!allowedBuckets.has(job.source_bucket) || !isPdfPath(job.source_path)) {
      throw Object.assign(new Error("Invalid PDF source"), { code: "INVALID_SOURCE" });
    }

    const sourceObject = await getObjectState(admin, job.source_bucket, job.source_path);
    if (!sourceObject) {
      throw Object.assign(new Error("Source storage object no longer exists"), { code: "SOURCE_NOT_FOUND" });
    }

    await markJob(admin, job.id, {
      temp_input_path: inputTempPath,
      temp_output_path: outputTempPath,
      source_object_updated_at: sourceObject.updated_at,
    });

    const { data: sourceBlob, error: downloadError } = await admin.storage
      .from(job.source_bucket)
      .download(job.source_path);

    if (downloadError || !sourceBlob) {
      throw Object.assign(new Error("Unable to read source PDF"), { code: "SOURCE_DOWNLOAD_FAILED" });
    }

    const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());
    const originalSize = sourceBytes.byteLength;

    if (originalSize > MAX_PDF_BYTES) {
      throw Object.assign(new Error("PDF exceeds the 50 MB processing limit"), { code: "PDF_TOO_LARGE" });
    }

    if (originalSize < MIN_PDF_BYTES) {
      await markJob(admin, job.id, {
        status: "original-kept",
        engine: ENGINE,
        original_size: originalSize,
        final_size: originalSize,
        completed_at: new Date().toISOString(),
      });
      return { status: "original-kept", jobId: job.id, reason: "already-small" };
    }

    if (
      sourceBytes[0] !== 0x25 ||
      sourceBytes[1] !== 0x50 ||
      sourceBytes[2] !== 0x44 ||
      sourceBytes[3] !== 0x46 ||
      sourceBytes[4] !== 0x2d
    ) {
      throw Object.assign(new Error("Source does not have a valid PDF header"), { code: "INVALID_PDF_HEADER" });
    }

    const { error: tempInputError } = await admin.storage
      .from(TMP_BUCKET)
      .upload(inputTempPath, sourceBytes, {
        upsert: true,
        contentType: "application/pdf",
        cacheControl: "no-store",
      });
    if (tempInputError) {
      throw Object.assign(new Error("Unable to stage source PDF"), { code: "STAGING_INPUT_FAILED" });
    }

    const sourcePdf = await PDFDocument.load(sourceBytes, {
      ignoreEncryption: false,
      preserveXFA: true,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    const pageCount = sourcePdf.getPageCount();
    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      throw Object.assign(new Error("Source PDF has an invalid page count"), { code: "SOURCE_VALIDATION_FAILED" });
    }

    const candidate = await sourcePdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false,
      objectsPerTick: 25,
    });

    if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
      throw Object.assign(new Error("Compression engine returned an empty PDF"), { code: "ENGINE_EMPTY_OUTPUT" });
    }

    const { error: tempOutputError } = await admin.storage
      .from(TMP_BUCKET)
      .upload(outputTempPath, candidate, {
        upsert: true,
        contentType: "application/pdf",
        cacheControl: "no-store",
      });
    if (tempOutputError) {
      throw Object.assign(new Error("Unable to stage optimized PDF"), { code: "STAGING_OUTPUT_FAILED" });
    }

    const optimizedPdf = await PDFDocument.load(candidate, {
      ignoreEncryption: false,
      preserveXFA: true,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    const optimizedPageCount = optimizedPdf.getPageCount();
    if (optimizedPageCount !== pageCount) {
      throw Object.assign(new Error("Optimized PDF changed page count"), { code: "PAGE_COUNT_MISMATCH" });
    }

    const optimizedSize = candidate.byteLength;
    if (optimizedSize >= originalSize) {
      await markJob(admin, job.id, {
        status: "original-kept",
        engine: ENGINE,
        original_size: originalSize,
        final_size: originalSize,
        page_count: pageCount,
        completed_at: new Date().toISOString(),
      });
      return { status: "original-kept", jobId: job.id, pageCount };
    }

    const latestSourceObject = await getObjectState(admin, job.source_bucket, job.source_path);
    if (!latestSourceObject || latestSourceObject.updated_at !== sourceObject.updated_at) {
      await markJob(admin, job.id, {
        status: "original-kept",
        engine: ENGINE,
        original_size: originalSize,
        final_size: originalSize,
        page_count: pageCount,
        error_code: "SOURCE_CHANGED",
        error_message: "Source changed while compression was running; original was not replaced.",
        completed_at: new Date().toISOString(),
      });
      return { status: "original-kept", jobId: job.id, reason: "source-changed" };
    }

    const { error: replaceError } = await admin.storage
      .from(job.source_bucket)
      .upload(job.source_path, candidate, {
        upsert: true,
        contentType: "application/pdf",
        cacheControl: "3600",
      });

    if (replaceError) {
      throw Object.assign(new Error("Optimized PDF could not replace the original"), { code: "SOURCE_REPLACE_FAILED" });
    }

    await updateMetadata(admin, job.source_bucket, job.source_path, optimizedSize);
    await markJob(admin, job.id, {
      status: "optimized",
      engine: ENGINE,
      original_size: originalSize,
      final_size: optimizedSize,
      page_count: pageCount,
      error_code: null,
      error_message: null,
      completed_at: new Date().toISOString(),
    });

    return {
      status: "optimized",
      jobId: job.id,
      pageCount,
      originalSize,
      optimizedSize,
      savingsBytes: originalSize - optimizedSize,
      savingsPercent: Number((((originalSize - optimizedSize) / originalSize) * 100).toFixed(2)),
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "COMPRESSION_FAILED";
    const message = error instanceof Error ? error.message : String(error);
    console.error("pdf-compression job failed:", job.id, code, message);
    await markJob(admin, job.id, {
      status: "failed",
      engine: ENGINE,
      error_code: code,
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).catch((markError) => console.error("pdf-compression failed-state update:", markError));
    return { status: "failed", jobId: job.id, errorCode: code };
  } finally {
    await admin.storage.from(TMP_BUCKET).remove([inputTempPath, outputTempPath]).catch(() => undefined);
  }
}

async function resolveTenant(
  admin: AdminClient,
  userId: string,
  requestedTenantId: string,
  role: string,
) {
  if (requestedTenantId) {
    const { data: membership } = await admin
      .from("compression_tenant_memberships")
      .select("tenant_id")
      .eq("tenant_id", requestedTenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return null;
    const { data: tenant } = await admin
      .from("compression_tenants")
      .select("id,status")
      .eq("id", requestedTenantId)
      .eq("status", "active")
      .maybeSingle();
    return tenant?.id || null;
  }

  const { data: memberships } = await admin
    .from("compression_tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId);

  const ids = [...new Set((memberships || []).map((row) => row.tenant_id).filter(Boolean))];
  if (ids.length) {
    const { data: tenants } = await admin
      .from("compression_tenants")
      .select("id")
      .in("id", ids)
      .eq("status", "active")
      .limit(2);
    if ((tenants || []).length === 1) return tenants[0].id;
    if ((tenants || []).length > 1) return null;
  }

  if (role !== "admin") return null;

  const slug = "learners-guide-default";
  const { data: existing } = await admin
    .from("compression_tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) {
    await admin.from("compression_tenant_memberships").upsert({
      tenant_id: existing.id,
      user_id: userId,
      membership_role: "owner",
    });
    return existing.id;
  }

  const { data: created, error: createError } = await admin
    .from("compression_tenants")
    .insert({
      name: "Learner's Guide",
      slug,
      status: "active",
      created_by: userId,
    })
    .select("id")
    .single();
  if (createError || !created) return null;

  await admin.from("compression_tenant_memberships").upsert({
    tenant_id: created.id,
    user_id: userId,
    membership_role: "owner",
  });
  return created.id;
}

async function enqueueJob(admin: AdminClient, userId: string, role: string, body: any) {
  const bucket = String(body?.bucket || "").trim();
  const path = String(body?.path || "").trim();
  const profile = String(body?.profile || "recommended").trim();
  const requestedTenantId = String(body?.tenantId || "").trim();

  if (!allowedBuckets.has(bucket) || !isPdfPath(path)) {
    return json({ error: "Only PDF files in supported storage buckets can be compressed." }, 400);
  }
  if (!allowedProfiles.has(profile)) {
    return json({ error: "Invalid compression profile." }, 400);
  }

  const object = await getObjectState(admin, bucket, path);
  if (!object) return json({ error: "Source file does not exist." }, 404);

  if (role !== "admin" && String(object.owner_id || "") !== userId) {
    return json({ error: "You are not allowed to enqueue compression for this file." }, 403);
  }

  const tenantId = await resolveTenant(admin, userId, requestedTenantId, role);
  if (!tenantId) {
    return json({ error: "A unique active compression tenant is required for this account." }, 409);
  }

  const { data: sourceRecord } = await admin
    .from(bucket === "homework" ? "homework" : "materials")
    .select("id")
    .eq("storage_path", path)
    .maybeSingle();

  if (!sourceRecord?.id) {
    return json({ error: "The PDF storage object is not linked to an application record." }, 409);
  }

  await admin
    .from("compression_tenant_sources")
    .upsert(
      {
        tenant_id: tenantId,
        source_bucket: bucket,
        source_path: path,
        source_record_id: String(sourceRecord.id),
      },
      { onConflict: "tenant_id,source_bucket,source_path" },
    );

  const { data: job, error } = await admin
    .from("pdf_compression_jobs")
    .insert({
      tenant_id: tenantId,
      requested_by: userId,
      source_bucket: bucket,
      source_path: path,
      profile,
      status: "queued",
      attempt_count: 0,
    })
    .select("id,tenant_id,status,profile,created_at")
    .single();

  if (error || !job) {
    console.error("pdf-compression enqueue:", error);
    return json({ error: "Unable to create compression job." }, 500);
  }

  EdgeRuntime.waitUntil(processJob(admin, job.id));
  return json(job, 202);
}

export default {
  fetch: withSupabase({ auth: ["user", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok");
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      const body = await req.json().catch(() => ({}));

      if (ctx.authMode === "secret") {
        const jobId = String(body?.jobId || "").trim();
        if (jobId) {
          return json(await processJob(ctx.supabaseAdmin, jobId));
        }

        const limit = Math.min(5, Math.max(1, Number(body?.limit || 1)));
        const { data: jobs, error } = await ctx.supabaseAdmin
          .from("pdf_compression_jobs")
          .select("id")
          .eq("status", "queued")
          .order("created_at", { ascending: true })
          .limit(limit);

        if (error) return json({ error: "Unable to read compression queue." }, 500);

        const results = [];
        for (const job of jobs || []) {
          results.push(await processJob(ctx.supabaseAdmin, job.id));
        }
        return json({ results });
      }

      const userId = String(ctx.userClaims?.sub || "");
      if (!userId) return json({ error: "Authenticated user is required." }, 401);
      const { data: authUser } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
      const role = String(authUser.user?.app_metadata?.role || "");
      return enqueueJob(ctx.supabaseAdmin, userId, role, body);
    } catch (error) {
      console.error("pdf-compression-jobs:", error);
      return json({ error: "Compression job could not be created safely." }, 500);
    }
  }),
};
