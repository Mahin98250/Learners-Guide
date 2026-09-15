import { createClient } from "npm:@supabase/supabase-js@2";
import {
  downloadDriveFile,
  folderFor,
  generateDriveFileId,
  getDriveFile,
  initiateResumableUpload,
  renameDriveFile,
  safeDriveName,
  trashDriveFile,
  verifyDriveUpload,
} from "../_shared/googleDrive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const allowedOrigins = new Set(
  (Deno.env.get("FILE_STORAGE_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const headersFor = (request: Request) => {
  const origin = request.headers.get("Origin") || "";
  const headers = new Headers({
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return headers;
};

const json = (request: Request, body: unknown, status = 200) => {
  const headers = headersFor(request);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
};

type Entity = "materials" | "homework";

const entityColumns: Record<Entity, string> = {
  materials: "id,title,name,folder_id,batch_id,subject,desc,date,tid,pdfname,pdfdata,storage_path,file_size,mime_type,storage_provider,storage_file_id,storage_status,storage_upload_id,storage_checksum,storage_checksum_algorithm,storage_error,created_at",
  homework: "id,cls,sec,subject,desc,given,due,tid,batch_id,pdfname,pdfdata,storage_path,file_size,mime_type,storage_provider,storage_file_id,storage_status,storage_upload_id,storage_checksum,storage_checksum_algorithm,storage_error,created_at",
};

const cleanText = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const cleanId = (value: unknown) => String(value ?? "").trim().slice(0, 200);
const fileName = (value: unknown) => cleanText(value, 180) || "file";
const mimeType = (value: unknown) => cleanText(value, 160) || "application/octet-stream";

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error("File storage backend is not configured.");
  }
}

function assertEntity(value: unknown): Entity {
  if (value !== "materials" && value !== "homework") throw new Error("Unsupported file entity.");
  return value;
}

async function authenticatedClients(request: Request) {
  assertConfigured();
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw Object.assign(new Error("Missing authorization"), { status: 401 });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Invalid authorization"), { status: 401 });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userClient, adminClient, user: data.user };
}

async function readAuthorizedRecord(userClient: ReturnType<typeof createClient>, entity: Entity, recordId: string) {
  const { data, error } = await userClient
    .from(entity)
    .select(entityColumns[entity])
    .eq("id", recordId)
    .maybeSingle();

  if (error) throw Object.assign(new Error("Unable to verify file authorization."), { status: 500 });
  if (!data) throw Object.assign(new Error("File not found or you are not authorized to access it."), { status: 404 });
  return data as Record<string, unknown>;
}

function uploadRecord(entity: Entity, record: Record<string, unknown>, uploadId: string, driveFileId: string, size: number, mime: string) {
  if (!record || typeof record !== "object") throw new Error("File record is required.");

  if (entity === "materials") {
    const title = cleanText(record.title, 240);
    const name = fileName(record.name || record.title);
    if (!title) throw new Error("Material title is required.");
    if (!cleanId(record.folder_id)) throw new Error("Material folder is required.");
    if (!cleanId(record.batch_id)) throw new Error("Material batch is required.");
    if (!cleanText(record.subject, 160)) throw new Error("Material subject is required.");
    return {
      id: cleanId(record.id) || crypto.randomUUID(),
      title,
      name,
      folder_id: cleanId(record.folder_id),
      batch_id: cleanId(record.batch_id),
      subject: cleanText(record.subject, 160),
      desc: record.desc == null ? null : cleanText(record.desc, 2000),
      date: cleanText(record.date, 40) || new Date().toISOString().slice(0, 10),
      tid: cleanId(record.tid) || null,
      pdfname: name,
      storage_provider: "google_drive",
      storage_file_id: driveFileId,
      storage_status: "uploading",
      storage_upload_id: uploadId,
      storage_checksum: null,
      storage_checksum_algorithm: null,
      storage_error: null,
      storage_path: null,
      pdfdata: null,
      pdfurl: null,
      file_size: size,
      mime_type: mime,
    };
  }

  const cls = cleanText(record.cls, 80);
  const sec = cleanText(record.sec, 80);
  const subject = cleanText(record.subject, 160);
  const desc = cleanText(record.desc, 4000);
  const due = cleanText(record.due, 40);
  const batchId = cleanId(record.batch_id);
  const tid = cleanId(record.tid);
  if (!cls || !sec || !subject || !desc || !due || !batchId || !tid) throw new Error("Homework class, section, subject, description, due date, batch and teacher are required.");

  return {
    id: cleanId(record.id) || crypto.randomUUID(),
    cls,
    sec,
    subject,
    desc,
    given: cleanText(record.given, 40) || new Date().toISOString().slice(0, 10),
    due,
    tid,
    batch_id: batchId,
    pdfname: fileName(record.pdfname || record.name),
    storage_provider: "google_drive",
    storage_file_id: driveFileId,
    storage_status: "uploading",
    storage_upload_id: uploadId,
    storage_checksum: null,
    storage_checksum_algorithm: null,
    storage_error: null,
    storage_path: null,
    pdfdata: null,
    file_size: size,
    mime_type: mime,
  };
}

async function initUpload(request: Request, userClient: ReturnType<typeof createClient>, adminClient: ReturnType<typeof createClient>) {
  const body = await request.json();
  const entity = assertEntity(body?.entity);
  const file = body?.file;
  const record = body?.record;

  const size = Number(file?.size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > 50 * 1024 * 1024) {
    throw Object.assign(new Error("File size must be between 1 byte and 50 MB."), { status: 400 });
  }

  const mime = mimeType(file?.mimeType);
  const name = fileName(file?.name);
  const uploadId = crypto.randomUUID();
  const driveFileId = await generateDriveFileId();
  const prepared = uploadRecord(entity, record, uploadId, driveFileId, size, mime);

  const { error: insertError } = await userClient.from(entity).insert(prepared);
  if (insertError) throw Object.assign(new Error(`Unable to create upload record: ${insertError.message}`), { status: 400 });

  try {
    const sessionUrl = await initiateResumableUpload({
      fileId: driveFileId,
      name,
      mimeType: mime,
      size,
      entity,
      recordId: String(prepared.id),
      uploadId,
    });
    return { recordId: prepared.id, uploadId, sessionUrl };
  } catch (error) {
    await adminClient.from(entity).update({
      storage_status: "failed",
      storage_error: error instanceof Error ? error.message.slice(0, 1000) : "Google Drive upload session failed",
    }).eq("id", prepared.id);
    throw error;
  }
}

async function finalizeUpload(request: Request, userClient: ReturnType<typeof createClient>, adminClient: ReturnType<typeof createClient>) {
  const body = await request.json();
  const entity = assertEntity(body?.entity);
  const recordId = cleanId(body?.recordId);
  const uploadId = cleanId(body?.uploadId);
  if (!recordId || !uploadId) throw Object.assign(new Error("Upload record and upload ID are required."), { status: 400 });

  const record = await readAuthorizedRecord(userClient, entity, recordId);
  if (String(record.storage_provider || "") !== "google_drive" || String(record.storage_upload_id || "") !== uploadId || String(record.storage_status || "") !== "uploading") {
    throw Object.assign(new Error("This upload is not in a finalizable state."), { status: 409 });
  }

  const driveFileId = cleanId(record.storage_file_id);
  if (!driveFileId) throw Object.assign(new Error("Upload record is missing its Google Drive file ID."), { status: 500 });

  try {
    const verified = await verifyDriveUpload({
      fileId: driveFileId,
      entity,
      recordId,
      uploadId,
      size: Number(record.file_size || 0),
      mimeType: mimeType(record.mime_type),
    });

    const { error } = await adminClient.from(entity).update({
      storage_status: "complete",
      storage_checksum: verified.md5Checksum || null,
      storage_checksum_algorithm: verified.md5Checksum ? "md5" : null,
      storage_error: null,
      file_size: verified.size,
      mime_type: verified.mimeType,
      ...(entity === "materials" ? { name: verified.name, pdfname: verified.name } : { pdfname: verified.name }),
    }).eq("id", recordId);
    if (error) throw new Error(`Unable to finalize database record: ${error.message}`);

    return { status: "complete", recordId, file: verified };
  } catch (error) {
    await adminClient.from(entity).update({
      storage_status: "failed",
      storage_error: error instanceof Error ? error.message.slice(0, 1000) : "Upload verification failed",
    }).eq("id", recordId);

    try { await trashDriveFile(driveFileId); } catch {}
    throw error;
  }
}

async function download(request: Request, userClient: ReturnType<typeof createClient>) {
  const body = await request.json();
  const entity = assertEntity(body?.entity);
  const recordId = cleanId(body?.recordId);
  if (!recordId) throw Object.assign(new Error("Record ID is required."), { status: 400 });

  const record = await readAuthorizedRecord(userClient, entity, recordId);
  if (String(record.storage_provider || "") !== "google_drive" || String(record.storage_status || "") !== "complete") {
    throw Object.assign(new Error("This file is not available from Google Drive."), { status: 404 });
  }

  const driveFileId = cleanId(record.storage_file_id);
  if (!driveFileId) throw Object.assign(new Error("File storage metadata is incomplete."), { status: 500 });

  const metadata = await getDriveFile(driveFileId);
  if (!metadata || metadata.trashed) throw Object.assign(new Error("The stored file is missing from Google Drive."), { status: 404 });

  const response = await downloadDriveFile(driveFileId);
  if (!response.ok || !response.body) throw Object.assign(new Error("Unable to retrieve the stored file."), { status: 502 });

  const headers = headersFor(request);
  const name = safeDriveName(String(metadata.name || record.name || record.pdfname || "download"));
  headers.set("Content-Type", String(metadata.mimeType || record.mime_type || "application/octet-stream"));
  headers.set("Content-Disposition", `inline; filename="${name.replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: 200, headers });
}

async function remove(request: Request, userClient: ReturnType<typeof createClient>, adminClient: ReturnType<typeof createClient>) {
  const body = await request.json();
  const entity = assertEntity(body?.entity);
  const recordId = cleanId(body?.recordId);
  if (!recordId) throw Object.assign(new Error("Record ID is required."), { status: 400 });

  const record = await readAuthorizedRecord(userClient, entity, recordId);
  const driveFileId = cleanId(record.storage_file_id);
  if (String(record.storage_provider || "") === "google_drive" && driveFileId) {
    await adminClient.from(entity).update({ storage_status: "deleting", storage_error: null }).eq("id", recordId);
    try {
      await trashDriveFile(driveFileId);
    } catch (error) {
      await adminClient.from(entity).update({ storage_status: "failed", storage_error: error instanceof Error ? error.message.slice(0, 1000) : "Google Drive delete failed" }).eq("id", recordId);
      throw error;
    }
  }

  const { error } = await adminClient.from(entity).delete().eq("id", recordId);
  if (error) throw new Error(`Unable to remove database record: ${error.message}`);
  return { status: "deleted", recordId };
}

async function rename(request: Request, userClient: ReturnType<typeof createClient>, adminClient: ReturnType<typeof createClient>) {
  const body = await request.json();
  const entity = assertEntity(body?.entity);
  const recordId = cleanId(body?.recordId);
  const name = fileName(body?.name);
  if (!recordId || !name) throw Object.assign(new Error("Record ID and filename are required."), { status: 400 });

  const record = await readAuthorizedRecord(userClient, entity, recordId);
  if (String(record.storage_provider || "") !== "google_drive" || String(record.storage_status || "") !== "complete") {
    throw Object.assign(new Error("This file is not a Google Drive file."), { status: 404 });
  }

  const driveFileId = cleanId(record.storage_file_id);
  await renameDriveFile(driveFileId, name);
  const payload = entity === "materials" ? { name, pdfname: name, title: cleanText(record.title, 240) || name } : { pdfname: name };
  const { error } = await adminClient.from(entity).update(payload).eq("id", recordId);
  if (error) throw new Error(`Unable to synchronize file metadata: ${error.message}`);
  return { status: "renamed", recordId, name };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(request) });

  try {
    const { userClient, adminClient } = await authenticatedClients(request);
    const body = await request.clone().json().catch(() => ({}));
    const action = cleanText(body?.action, 40);

    if (action === "init-upload") return json(request, await initUpload(request, userClient, adminClient));
    if (action === "finalize-upload") return json(request, await finalizeUpload(request, userClient, adminClient));
    if (action === "download") return await download(request, userClient);
    if (action === "delete") return json(request, await remove(request, userClient, adminClient));
    if (action === "rename") return json(request, await rename(request, userClient, adminClient));

    return json(request, { error: "Unsupported storage operation." }, 400);
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    const message = error instanceof Error ? error.message : "File storage operation failed.";
    console.error("file-storage:", message);
    return json(request, { error: message }, status);
  }
});
