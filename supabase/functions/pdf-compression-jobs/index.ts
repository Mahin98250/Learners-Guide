import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1.7.0";
import { PDFDocument } from "npm:@cantoo/pdf-lib@2.11.0";

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MIN_PDF_BYTES = 256 * 1024;
const TMP_BUCKET = "pdf-compression-tmp";
const STRUCTURAL_ENGINE = "cantoo-pdf-lib-structural-v1";
const RASTER_ENGINE = "sharp-pdf-raster-v1";
const getRasterWorkerUrl = () => Deno.env.get("PDF_COMPRESSION_RASTER_WORKER_URL")?.trim() || "";
const allowedBuckets = new Set(["homework", "materials"]);
const allowedProfiles = new Set(["recommended", "extreme", "less"]);

type AdminClient = any;

type RasterWorkerResult = {
  status: "candidate" | "no-change" | "invalid-candidate";
  bytes?: Uint8Array;
  stats?: {
    imagesScanned?: number;
    imagesRecompressed?: number;
    rasterOriginalBytes?: number;
    rasterFinalBytes?: number;
  };
};

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
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id,tenant_id,source_bucket,source_path,profile,attempt_count")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function runRasterWorker(
  admin: AdminClient,
  job: {
    id: string;
    profile: "recommended" | "extreme" | "less";
  },
  inputTempPath: string,
  outputTempPath: string,
): Promise<RasterWorkerResult | null> {
  const workerUrl = getRasterWorkerUrl();
  if (!workerUrl) {
    console.warn("pdf-compression: raster worker URL is not configured; structural fallback will be used.");
    return null;
  }

  try {
    const { data: signedInput, error: inputSignError } = await admin.storage
      .from(TMP_BUCKET)
      .createSignedUrl(inputTempPath, 300);
    if (inputSignError || !signedInput?.signedUrl) {
      console.warn("pdf-compression: unable to create raster input URL");
      return null;
    }

    const { data: signedOutput, error: outputSignError } = await admin.storage
      .from(TMP_BUCKET)
      .createSignedUploadUrl(outputTempPath, { upsert: true });
    if (outputSignError || !signedOutput?.signedUrl) {
      console.warn("pdf-compression: unable to create raster output URL");
      return null;
    }

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        profile: job.profile,
        sourceUrl: signedInput.signedUrl,
        uploadUrl: signedOutput.signedUrl,
        outputPath: outputTempPath,
      }),
    });

    if (!response.ok) {
      console.warn("pdf-compression: raster worker returned HTTP", response.status);
      return null;
    }

    const result = await response.json().catch(() => null);
    if (!result || typeof result !== "object") return null;

    const stats = {
      imagesScanned: Number(result.stats?.imagesScanned || 0),
      imagesRecompressed: Number(result.stats?.imagesRecompressed || 0),
      rasterOriginalBytes: Number(result.stats?.rasterOriginalBytes || 0),
      rasterFinalBytes: Number(result.stats?.rasterFinalBytes || 0),
    };

    if (result.status === "no-change" || result.status === "invalid-candidate") {
      return { status: result.status, stats };
    }

    if (result.status !== "candidate" || result.outputPath !== outputTempPath) {
      console.warn("pdf-compression: raster worker returned an unexpected candidate");
      return null;
    }

    const { data: blob, error: downloadError } = await admin.storage
      .from(TMP_BUCKET)
      .download(outputTempPath);

    if (downloadError || !blob) {
      console.warn("pdf-compression: raster candidate could not be downloaded");
      return null;
    }

    return {
      status: "candidate",
      bytes: new Uint8Array(await blob.arrayBuffer()),
      stats,
    };
  } catch (error) {
    console.warn(
      "pdf-compression: raster worker unavailable; structural fallback will be used.",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function validateCandidate(candidate: Uint8Array, expectedPageCount: number) {
  try {
    if (candidate.byteLength === 0 || candidate.byteLength > MAX_PDF_BYTES) return false;
    const pdf = await PDFDocument.load(candidate, {
      ignoreEncryption: false,
      preserveXFA: true,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    return pdf.getPageCount() === expectedPageCount;
  } catch {
    return false;
  }
}

async function processJob(admin: AdminClient, jobId: string) {
  const job = await claimJob(admin, jobId);
  if (!job) return { status: "not-claimed", jobId };

  const tempRoot = String(job.tenant_id) + "/" + String(job.id);
  const inputTempPath = tempRoot + "/input.pdf";
  const outputTempPath = tempRoot + "/output.pdf";

  let rasterStats = {
    imagesScanned: 0,
    imagesRecompressed: 0,
    rasterOriginalBytes: 0,
    rasterFinalBytes: 0,
  };

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
        engine: STRUCTURAL_ENGINE,
        original_size: originalSize,
        final_size: originalSize,
        savings_bytes: 0,
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

    let candidate: Uint8Array | null = null;
    let engine = STRUCTURAL_ENGINE;

    const rasterResult = await runRasterWorker(
      admin,
      { id: String(job.id), profile: job.profile },
      inputTempPath,
      outputTempPath,
    );

    if (rasterResult?.stats) {
      rasterStats = {
        imagesScanned: Math.max(0, rasterResult.stats.imagesScanned || 0),
        imagesRecompressed: Math.max(0, rasterResult.stats.imagesRecompressed || 0),
        rasterOriginalBytes: Math.max(0, rasterResult.stats.rasterOriginalBytes || 0),
        rasterFinalBytes: Math.max(0, rasterResult.stats.rasterFinalBytes || 0),
      };
    }

    if (rasterResult?.status === "candidate" && rasterResult.bytes) {
      const rasterCandidateIsValid =
        rasterResult.bytes.byteLength < originalSize &&
        (await validateCandidate(rasterResult.bytes, pageCount));

      if (rasterCandidateIsValid) {
        candidate = rasterResult.bytes;
        engine = RASTER_ENGINE;
      } else {
        console.warn("pdf-compression: raster candidate rejected; structural fallback will run");
      }
    }

    if (!candidate) {
      candidate = await sourcePdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false,
        objectsPerTick: 25,
      });

      if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
        throw Object.assign(new Error("Compression engine returned an empty PDF"), { code: "ENGINE_EMPTY_OUTPUT" });
      }

      const { error: tempOutputError } = await admin.storage.from(TMP_BUCKET).upload(
        outputTempPath,
        candidate,
        {
          upsert: true,
          contentType: "application/pdf",
          cacheControl: "no-store",
        },
      );
      if (tempOutputError) {
        throw Object.assign(new Error("Unable to stage optimized PDF"), { code: "STAGING_OUTPUT_FAILED" });
      }

      engine = STRUCTURAL_ENGINE;
    }

    if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
      throw Object.assign(new Error("Compression produced an empty PDF"), { code: "ENGINE_EMPTY_OUTPUT" });
    }

    const candidateIsValid = await validateCandidate(candidate, pageCount);
    if (!candidateIsValid) {
      throw Object.assign(new Error("Optimized PDF failed validation"), { code: "OUTPUT_VALIDATION_FAILED" });
    }

    const optimizedSize = candidate.byteLength;
    if (optimizedSize >= originalSize) {
      await markJob(admin, job.id, {
        status: "original-kept",
        engine,
        original_size: originalSize,
        final_size: originalSize,
        savings_bytes: 0,
        page_count: pageCount,
        image_count: rasterStats.imagesScanned,
        image_recompressed_count: rasterStats.imagesRecompressed,
        raster_original_bytes: rasterStats.rasterOriginalBytes,
        raster_final_bytes: rasterStats.rasterFinalBytes,
        completed_at: new Date().toISOString(),
      });
      return { status: "original-kept", jobId: job.id, pageCount };
    }

    const latestSourceObject = await getObjectState(admin, job.source_bucket, job.source_path);
    if (!latestSourceObject || latestSourceObject.updated_at !== sourceObject.updated_at) {
      await markJob(admin, job.id, {
        status: "original-kept",
        engine,
        original_size: originalSize,
        final_size: originalSize,
        savings_bytes: 0,
        page_count: pageCount,
        image_count: rasterStats.imagesScanned,
        image_recompressed_count: rasterStats.imagesRecompressed,
        raster_original_bytes: rasterStats.rasterOriginalBytes,
        raster_final_bytes: rasterStats.rasterFinalBytes,
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
      engine,
      original_size: originalSize,
      final_size: optimizedSize,
      savings_bytes: originalSize - optimizedSize,
      page_count: pageCount,
      error_code: null,
      error_message: null,
      image_count: rasterStats.imagesScanned,
      image_recompressed_count: rasterStats.imagesRecompressed,
      raster_original_bytes: rasterStats.rasterOriginalBytes,
      raster_final_bytes: rasterStats.rasterFinalBytes,
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
      imageCount: rasterStats.imagesScanned,
      imageRecompressedCount: rasterStats.imagesRecompressed,
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "COMPRESSION_FAILED";
    const message = error instanceof Error ? error.message : String(error);
    console.error("pdf-compression job failed:", job.id, code, message);
    await markJob(admin, job.id, {
      status: "failed",
      engine: STRUCTURAL_ENGINE,
      image_count: rasterStats.imagesScanned,
      image_recompressed_count: rasterStats.imagesRecompressed,
      raster_original_bytes: rasterStats.rasterOriginalBytes,
      raster_final_bytes: rasterStats.rasterFinalBytes,
      error_code: code,
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).catch((markError) => console.error("pdf-compression failed-state update:", markError));
    return { status: "failed", jobId, errorCode: code };
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

  // The compression tenant is only a temporary bridge until the real
  // institute/customer tenant registry is introduced. If an authenticated
  // user has no bridge tenant yet, give that user an isolated tenant rather
  // than silently failing the upload. This does NOT grant any source access:
  // source ownership and the application record binding are still checked.
  const slug = `compression-user-${userId.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;
  const name = role === "admin" ? "Mahin" : `Mahin User ${userId.slice(0, 8)}`;

  const { data: existing } = await admin
    .from("compression_tenants")
    .select("id,status")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id && existing.status === "active") {
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
      name,
      slug,
      status: "active",
      created_by: userId,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    console.error("pdf-compression tenant bridge creation failed:", createError);
    return null;
  }

  const { error: membershipError } = await admin
    .from("compression_tenant_memberships")
    .upsert({
      tenant_id: created.id,
      user_id: userId,
      membership_role: "owner",
    });

  if (membershipError) {
    console.error("pdf-compression tenant membership creation failed:", membershipError);
    await admin.from("compression_tenants").delete().eq("id", created.id);
    return null;
  }

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
      attempt_count: 1,
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
