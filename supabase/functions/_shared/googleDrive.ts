const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithBackoff(input: RequestInfo | URL, init: RequestInit = {}, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
      lastError = new Error(`Google Drive HTTP ${response.status}`);
      if (attempt < attempts - 1) await sleep(500 * 2 ** attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Google Drive request failed");
}

export async function googleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN") || "";
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Drive credentials are not configured.");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetchWithBackoff(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google OAuth token refresh failed (${response.status}). ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error("Google OAuth response did not contain an access token.");
  return String(data.access_token);
}

async function driveRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await googleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetchWithBackoff(`${DRIVE_API}${path}`, { ...init, headers });
}

export function safeDriveName(name: string): string {
  const normalized = String(name || "file").normalize("NFKC").replace(/[\\/\\0]/g, "_").replace(/[<>:"|?*]/g, "_").trim();
  return normalized.slice(0, 180) || "file";
}

export function folderFor(entity: "materials" | "homework"): string {
  const id = Deno.env.get(entity === "materials" ? "GOOGLE_DRIVE_MATERIALS_FOLDER_ID" : "GOOGLE_DRIVE_HOMEWORK_FOLDER_ID");
  const root = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID") || "";
  const chosen = id || root;
  if (!chosen) throw new Error("Google Drive root folder is not configured.");
  return chosen;
}

export async function generateDriveFileId(): Promise<string> {
  const response = await driveRequest("/files/generateIds?count=1&space=drive&fields=ids");
  if (!response.ok) throw new Error(`Google Drive could not allocate a file ID (${response.status}).`);
  const data = await response.json();
  const id = data?.ids?.[0];
  if (!id) throw new Error("Google Drive did not return a file ID.");
  return String(id);
}

export async function initiateResumableUpload(args: {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  entity: "materials" | "homework";
  recordId: string;
  uploadId: string;
}): Promise<string> {
  const folderId = folderFor(args.entity);
  const token = await googleAccessToken();

  const response = await fetchWithBackoff(`${DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,size,mimeType,md5Checksum,parents,appProperties,trashed,modifiedTime`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": args.mimeType,
      "X-Upload-Content-Length": String(args.size),
    },
    body: JSON.stringify({
      id: args.fileId,
      name: safeDriveName(args.name),
      mimeType: args.mimeType,
      parents: [folderId],
      appProperties: {
        lg_entity: args.entity,
        lg_record_id: args.recordId,
        lg_upload_id: args.uploadId,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive upload-session creation failed (${response.status}). ${detail.slice(0, 300)}`);
  }

  const location = response.headers.get("Location");
  if (!location) throw new Error("Google Drive did not return a resumable upload session.");
  return location;
}

export async function getDriveFile(fileId: string) {
  const response = await driveRequest(`/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType,md5Checksum,parents,appProperties,trashed,modifiedTime`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Google Drive file lookup failed (${response.status}).`);
  return response.json();
}

export async function trashDriveFile(fileId: string): Promise<void> {
  const response = await driveRequest(`/files/${encodeURIComponent(fileId)}?supportsAllDrives=false`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive file trash failed (${response.status}). ${detail.slice(0, 300)}`);
  }
}

export async function renameDriveFile(fileId: string, name: string): Promise<void> {
  const response = await driveRequest(`/files/${encodeURIComponent(fileId)}?supportsAllDrives=false`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: safeDriveName(name) }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive rename failed (${response.status}). ${detail.slice(0, 300)}`);
  }
}

export async function downloadDriveFile(fileId: string): Promise<Response> {
  const token = await googleAccessToken();
  return fetchWithBackoff(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function verifyDriveUpload(args: {
  fileId: string;
  entity: "materials" | "homework";
  recordId: string;
  uploadId: string;
  size: number;
  mimeType: string;
}): Promise<{ name: string; size: number; mimeType: string; md5Checksum?: string }> {
  const file = await getDriveFile(args.fileId);
  if (!file || file.trashed) throw new Error("Uploaded Google Drive file was not found.");
  const app = file.appProperties || {};
  if (String(app.lg_entity || "") !== args.entity || String(app.lg_record_id || "") !== args.recordId || String(app.lg_upload_id || "") !== args.uploadId) {
    throw new Error("Google Drive file does not match the expected application upload.");
  }
  const parents = Array.isArray(file.parents) ? file.parents.map(String) : [];
  if (!parents.includes(folderFor(args.entity))) throw new Error("Google Drive file is outside the configured application folder.");
  if (Number(file.size || 0) !== Number(args.size)) throw new Error("Google Drive file size does not match the uploaded file.");
  if (String(file.mimeType || "") !== String(args.mimeType || "application/octet-stream")) throw new Error("Google Drive MIME type does not match the uploaded file.");
  return {
    name: String(file.name || "file"),
    size: Number(file.size || 0),
    mimeType: String(file.mimeType || args.mimeType || "application/octet-stream"),
    ...(file.md5Checksum ? { md5Checksum: String(file.md5Checksum) } : {}),
  };
}
