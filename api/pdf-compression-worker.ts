import { PDFDocument } from "pdf-lib";
import { compressPdfRaster, type PdfRasterCompressionProfile } from "../src/server/pdfRasterCompression";

const PROJECT_REF = "efnxjfzyqbdulpjhffsm";
const SUPABASE_HOST = `${PROJECT_REF}.supabase.co`;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_INPUT_RESPONSE_BYTES = MAX_PDF_BYTES + 1024 * 1024;
const profiles = new Set<PdfRasterCompressionProfile>(["recommended", "extreme", "less"]);

type NodeRequest = {
  method?: string;
  body?: unknown;
  on?: (event: string, listener: (...args: any[]) => void) => void;
};

type NodeResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

type WorkerRequest = {
  jobId?: unknown;
  profile?: unknown;
  sourceUrl?: unknown;
  uploadUrl?: unknown;
  outputPath?: unknown;
};

const json = (res: NodeResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

function isAllowedSignedUrl(value: string, kind: "download" | "upload") {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== SUPABASE_HOST) return false;

    if (kind === "download") {
      return url.pathname.startsWith("/storage/v1/object/sign/");
    }

    return url.pathname.startsWith("/storage/v1/object/upload/sign/");
  } catch {
    return false;
  }
}

async function readJson(req: NodeRequest): Promise<WorkerRequest> {
  if (req.body && typeof req.body === "object") return req.body as WorkerRequest;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on?.("data", (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.byteLength;
      if (total > 256 * 1024) {
        reject(new Error("Request body too large."));
        return;
      }
      chunks.push(bytes);
    });

    req.on?.("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as WorkerRequest);
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on?.("error", reject);
  });
}

async function downloadPdf(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    redirect: "error",
    headers: { accept: "application/pdf" },
  });

  if (!response.ok) {
    throw new Error(`Signed PDF download failed with HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_INPUT_RESPONSE_BYTES) {
    throw new Error("Signed PDF is above the Phase 3 worker limit.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("Signed PDF is empty or exceeds the 50 MB limit.");
  }

  if (
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    throw new Error("Signed source did not contain a PDF.");
  }

  return bytes;
}

async function validateCandidate(candidate: Uint8Array, expectedPageCount: number) {
  if (candidate.byteLength === 0 || candidate.byteLength > MAX_PDF_BYTES) return false;

  try {
    const pdf = await PDFDocument.load(candidate, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    return pdf.getPageCount() === expectedPageCount;
  } catch {
    return false;
  }
}

async function uploadCandidate(uploadUrl: string, candidate: Uint8Array) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    redirect: "error",
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      "x-upsert": "true",
    },
    body: candidate,
  });

  if (!response.ok) {
    throw new Error(`Signed PDF upload failed with HTTP ${response.status}.`);
  }
}

export default async function handler(req: NodeRequest, res: NodeResponse) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJson(req);
    const jobId = String(body.jobId || "").trim();
    const profile = String(body.profile || "recommended").trim() as PdfRasterCompressionProfile;
    const sourceUrl = String(body.sourceUrl || "").trim();
    const uploadUrl = String(body.uploadUrl || "").trim();
    const outputPath = String(body.outputPath || "").trim();

    if (!jobId || jobId.length > 128) {
      json(res, 400, { error: "A valid compression job ID is required." });
      return;
    }
    if (!profiles.has(profile)) {
      json(res, 400, { error: "Invalid compression profile." });
      return;
    }
    if (!outputPath || !outputPath.endsWith("/output.pdf") || outputPath.length > 512) {
      json(res, 400, { error: "Invalid private output path." });
      return;
    }
    if (!isAllowedSignedUrl(sourceUrl, "download")) {
      json(res, 400, { error: "Source URL must be a signed Supabase Storage URL." });
      return;
    }
    if (!isAllowedSignedUrl(uploadUrl, "upload")) {
      json(res, 400, { error: "Upload URL must be a signed Supabase Storage URL." });
      return;
    }

    const source = await downloadPdf(sourceUrl);
    const sourcePdf = await PDFDocument.load(source, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    const pageCount = sourcePdf.getPageCount();

    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      json(res, 422, { error: "Source PDF has an invalid page count." });
      return;
    }

    const compressed = await compressPdfRaster(source, profile);
    if (
      compressed.bytes.byteLength >= source.byteLength ||
      compressed.bytes.byteLength === 0 ||
      compressed.stats.imagesRecompressed <= 0
    ) {
      json(res, 200, {
        ok: true,
        status: "no-change",
        jobId,
        pageCount,
        originalSize: source.byteLength,
        candidateSize: compressed.bytes.byteLength,
        stats: compressed.stats,
      });
      return;
    }

    const valid = await validateCandidate(compressed.bytes, pageCount);
    if (!valid) {
      json(res, 200, {
        ok: true,
        status: "invalid-candidate",
        jobId,
        pageCount,
        originalSize: source.byteLength,
        candidateSize: compressed.bytes.byteLength,
        stats: compressed.stats,
      });
      return;
    }

    await uploadCandidate(uploadUrl, compressed.bytes);

    json(res, 200, {
      ok: true,
      status: "candidate",
      jobId,
      outputPath,
      pageCount,
      originalSize: source.byteLength,
      candidateSize: compressed.bytes.byteLength,
      stats: compressed.stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("pdf-compression-worker:", message);
    json(res, 500, { ok: false, error: "Raster compression worker failed safely." });
  }
}
