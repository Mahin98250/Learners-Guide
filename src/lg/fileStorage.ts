import { SB_URL, SB_KEY, supabase } from "@/lg/supabase";

export type FileEntity = "materials" | "homework";

type StorageResponse<T = unknown> = {
  data?: T;
  error?: string;
};

const endpoint = () => `${SB_URL}/functions/v1/file-storage`;

async function callGateway<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: SB_KEY,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const payload: StorageResponse<T> = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `File storage request failed (${response.status}).`);
  return (payload.data ?? payload) as T;
}

async function uploadToSession(sessionUrl: string, file: File, onProgress?: (value: number) => void): Promise<Record<string, unknown>> {
  const chunkSize = 8 * 1024 * 1024;
  const maxTransientRetries = 4;
  let offset = 0;
  let transientRetries = 0;

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end);
    let response: Response;

    try {
      response = await fetch(sessionUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.size),
          "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
        },
        body: chunk,
      });
    } catch {
      if (++transientRetries > maxTransientRetries) {
        throw new Error("Upload connection was interrupted repeatedly. Please retry the upload.");
      }
      try {
        const statusResponse = await fetch(sessionUrl, {
          method: "PUT",
          headers: { "Content-Range": `bytes */${file.size}` },
        });
        if (statusResponse.ok) return await statusResponse.json();
        if (statusResponse.status === 404) throw new Error("Google Drive upload session expired. Please retry the upload.");
        if (statusResponse.status !== 308) throw new Error(`Upload resume check failed (${statusResponse.status}).`);
        const range = statusResponse.headers.get("Range");
        offset = range ? Number(range.match(/(\\d+)$/)?.[1] || -1) + 1 : 0;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (transientRetries - 1)));
        continue;
      } catch (resumeError) {
        if (resumeError instanceof Error && resumeError.message.includes("expired")) throw resumeError;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (transientRetries - 1)));
        continue;
      }
    }

    if (response.status === 308) {
      transientRetries = 0;
      const range = response.headers.get("Range");
      const receivedThrough = range ? Number(range.match(/(\\d+)$/)?.[1] || -1) : end - 1;
      offset = receivedThrough + 1;
      onProgress?.(Math.min(100, Math.round(offset / file.size * 100)));
      continue;
    }

    if (response.ok) {
      transientRetries = 0;
      onProgress?.(100);
      return await response.json();
    }

    if ([429, 500, 502, 503, 504].includes(response.status)) {
      if (++transientRetries > maxTransientRetries) {
        throw new Error(`Google Drive upload failed after retries (${response.status}).`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (transientRetries - 1)));
      continue;
    }

    throw new Error(`Google Drive upload failed (${response.status}).`);
  }

  throw new Error("Google Drive upload ended without a completion response.");
}

export async function uploadFile(args: {
  entity: FileEntity;
  record: Record<string, unknown>;
  file: File;
  onProgress?: (value: number) => void;
}) {
  if (!args.file || args.file.size <= 0) throw new Error("Choose a file first.");
  if (args.file.size > 50 * 1024 * 1024) throw new Error("Maximum file size is 50 MB.");

  const initiated = await callGateway<{ recordId: string; uploadId: string; sessionUrl: string }>({
    action: "init-upload",
    entity: args.entity,
    record: args.record,
    file: {
      name: args.file.name,
      size: args.file.size,
      mimeType: args.file.type || "application/octet-stream",
    },
  });

  await uploadToSession(initiated.sessionUrl, args.file, args.onProgress);

  return callGateway({
    action: "finalize-upload",
    entity: args.entity,
    recordId: initiated.recordId,
    uploadId: initiated.uploadId,
  });
}

export async function downloadFile(entity: FileEntity, recordId: string): Promise<Blob> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: SB_KEY,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ action: "download", entity, recordId }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Unable to retrieve the file (${response.status}).`);
  }

  return response.blob();
}

export async function deleteFile(entity: FileEntity, recordId: string) {
  return callGateway({ action: "delete", entity, recordId });
}

export async function renameFile(entity: FileEntity, recordId: string, name: string) {
  return callGateway({ action: "rename", entity, recordId, name });
}
