import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:@cantoo/pdf-lib@2.11.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const allowedBuckets = new Set(["homework", "materials"]);
const isPdfPath = (path: string) => /\.pdf$/i.test(path);

async function getCaller(admin: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin.auth.admin.getUserById(data.user.id);
  return {
    id: data.user.id,
    role: String(profile.user?.app_metadata?.role || ""),
    ref: String(profile.user?.app_metadata?.ref || ""),
  };
}

async function authorizePath(admin: ReturnType<typeof createClient>, bucket: string, path: string, caller: { role: string; ref: string }) {
  if (caller.role === "admin") return true;
  if (caller.role !== "teacher" || !caller.ref) return false;

  const table = bucket === "homework" ? "homework" : "materials";
  const { data, error } = await admin
    .from(table)
    .select("id,tid")
    .eq("storage_path", path)
    .limit(10);
  if (error) return false;
  return (data || []).some((row) => String(row.tid || "") === caller.ref);
}

async function updateMetadata(admin: ReturnType<typeof createClient>, bucket: string, path: string, size: number) {
  const table = bucket === "homework" ? "homework" : "materials";
  await admin.from(table).update({ file_size: size, mime_type: "application/pdf" }).eq("storage_path", path);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anon || !service) return json({ error: "Optimizer is not configured" }, 500);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Missing authorization" }, 401);
    const token = authorization.replace(/^Bearer\s+/i, "");

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const caller = await getCaller(admin, token);
    if (!caller) return json({ error: "Invalid authorization" }, 401);
    if (!new Set(["admin", "teacher"]).has(caller.role)) return json({ error: "Only staff can optimize uploaded files" }, 403);

    const body = await req.json();
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim();
    if (!allowedBuckets.has(bucket) || !path) return json({ error: "Invalid bucket or path" }, 400);
    if (!(await authorizePath(admin, bucket, path, caller))) return json({ error: "You are not allowed to optimize this file" }, 403);

    if (!isPdfPath(path)) {
      return json({ status: "skipped", reason: "format-not-supported", originalSize: null, optimizedSize: null });
    }

    const { data: original, error: downloadError } = await admin.storage.from(bucket).download(path);
    if (downloadError || !original) return json({ error: "Unable to read uploaded file" }, 502);

    const originalBytes = new Uint8Array(await original.arrayBuffer());
    const originalSize = originalBytes.byteLength;
    if (originalSize < 512 * 1024) {
      return json({ status: "skipped", reason: "already-small", originalSize, optimizedSize: originalSize });
    }

    const source = await PDFDocument.load(originalBytes, { ignoreEncryption: false });
    const pageCount = source.getPageCount();

    // Safe first pass: rebuild the document with object streams and shared-content
    // deduplication enabled. This does not intentionally remove pages, text, images,
    // annotations, forms, attachments, or links.
    const optimizedBytes = await source.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false,
      objectsPerTick: 50,
    });

    if (optimizedBytes.byteLength >= originalSize) {
      return json({ status: "unchanged", reason: "optimized-version-not-smaller", originalSize, optimizedSize: originalSize, pageCount });
    }

    // Structural validation gate: the candidate must be readable and have exactly
    // the same number of pages before it can replace the original.
    const check = await PDFDocument.load(optimizedBytes, { ignoreEncryption: false });
    if (check.getPageCount() !== pageCount) {
      return json({ status: "rejected", reason: "validation-page-count-mismatch", originalSize, optimizedSize: originalSize, pageCount });
    }

    const replacement = new Blob([optimizedBytes], { type: "application/pdf" });
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, replacement, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });
    if (uploadError) return json({ error: "Optimized file could not replace the original", originalSize, optimizedSize: originalSize }, 502);

    await updateMetadata(admin, bucket, path, optimizedBytes.byteLength);

    return json({
      status: "optimized",
      originalSize,
      optimizedSize: optimizedBytes.byteLength,
      savedBytes: originalSize - optimizedBytes.byteLength,
      savingsPercent: Number((((originalSize - optimizedBytes.byteLength) / originalSize) * 100).toFixed(2)),
      pageCount,
      profile: "safe-structural-pdf-v1",
    });
  } catch (error) {
    console.error("file-optimizer:", error);
    return json({ error: "Optimization failed safely; the original upload was kept" }, 500);
  }
});
