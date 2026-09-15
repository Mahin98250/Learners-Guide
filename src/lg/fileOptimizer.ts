import { PDFDocument } from "pdf-lib";

export type OptimizationProgress = (message: string) => void;
export type OptimizationStatus = "optimized" | "original-kept" | "failed";

export type OptimizationResult = {
  file: File;
  originalSize: number;
  optimizedSize: number;
  savingsBytes: number;
  savingsPercent: number;
  optimized: boolean;
  status: OptimizationStatus;
  engine: "qpdf-wasm" | "original";
};

const PDF_MIME = "application/pdf";
const MIN_INPUT_BYTES = 512 * 1024;

const percent = (saved: number, original: number) =>
  original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;

const emit = (detail: Record<string, unknown>) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lg:pdf-optimization", { detail }));
  }
};

type PdfValidation = { valid: boolean; reason?: string };

async function validatePdfCandidate(input: File, candidate: Blob): Promise<PdfValidation> {
  const [inputBytes, candidateBytes] = await Promise.all([
    input.arrayBuffer(),
    candidate.arrayBuffer(),
  ]);

  const header = new TextDecoder("ascii").decode(candidateBytes.slice(0, 5));
  if (header !== "%PDF-") {
    return { valid: false, reason: "optimized output is not a PDF" };
  }

  let source: PDFDocument;
  let optimized: PDFDocument;
  try {
    [source, optimized] = await Promise.all([
      PDFDocument.load(inputBytes, { updateMetadata: false, ignoreEncryption: true }),
      PDFDocument.load(candidateBytes, { updateMetadata: false, ignoreEncryption: true }),
    ]);
  } catch (error) {
    return {
      valid: false,
      reason: `optimized PDF could not be reopened: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  const sourcePages = source.getPageCount();
  const optimizedPages = optimized.getPageCount();
  if (sourcePages !== optimizedPages) {
    return { valid: false, reason: `page count changed (${sourcePages} → ${optimizedPages})` };
  }

  for (const page of optimized.getPages()) {
    const width = page.getWidth();
    const height = page.getHeight();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { valid: false, reason: "optimized PDF contains an invalid page size" };
    }
  }

  return { valid: true };
}

const originalResult = (
  input: File,
  status: "original-kept" | "failed",
): OptimizationResult => ({
  file: input,
  originalSize: input.size,
  optimizedSize: input.size,
  savingsBytes: 0,
  savingsPercent: 0,
  optimized: false,
  status,
  engine: "original",
});

async function qpdfOptimize(input: File, onProgress?: OptimizationProgress): Promise<Blob> {
  const { createQpdfRunner } = await import("qpdf-run");
  const workerUrl = new URL("qpdf-run/worker", import.meta.url).href;
  const qpdfJsUrl = new URL("qpdf-run/qpdf.js", import.meta.url).href;
  const wasmUrl = new URL("qpdf-run/qpdf.wasm", import.meta.url).href;

  const qpdf = await createQpdfRunner({
    workerUrl,
    qpdfJsUrl,
    wasmUrl,
    timeoutMs: Math.max(60_000, Math.min(180_000, 20_000 + Math.ceil(input.size / (1024 * 1024)) * 2500)),
  });

  try {
    onProgress?.("Starting safe PDF optimizer…");
    const bytes = new Uint8Array(await input.arrayBuffer());
    const result = await qpdf.runOne({
      input: bytes,
      inputName: "input.pdf",
      outputName: "output.pdf",
      args: [
        "--compress-streams=y",
        "--decode-level=generalized",
        "--recompress-flate",
        "--compression-level=9",
        "--object-streams=generate",
        "--optimize-images",
        "--",
        "input.pdf",
        "output.pdf",
      ],
    });

    if (!(result instanceof Uint8Array) || result.length === 0) {
      throw new Error("qpdf returned no output");
    }

    onProgress?.("Safe PDF optimization completed.");
    return new Blob([result], { type: PDF_MIME });
  } finally {
    await qpdf.destroy();
  }
}

export async function optimizePdfFile(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<OptimizationResult> {
  if (input.type !== PDF_MIME && !input.name.toLowerCase().endsWith(".pdf")) {
    return originalResult(input, "original-kept");
  }

  if (input.size < MIN_INPUT_BYTES) {
    emit({
      status: "original-kept",
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: input.size,
      savingsBytes: 0,
      savingsPercent: 0,
      message: "Original kept — PDF is already small.",
    });
    return originalResult(input, "original-kept");
  }

  try {
    onProgress?.("Analyzing PDF…");
    emit({
      status: "processing",
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: null,
      savingsBytes: null,
      savingsPercent: null,
      message: "Analyzing PDF…",
    });

    const candidate = await qpdfOptimize(input, onProgress);
    const candidateSize = candidate.size;

    if (candidateSize <= 0 || candidateSize >= input.size) {
      const fallback = originalResult(input, "original-kept");
      emit({
        ...fallback,
        fileName: input.name,
        message: "No safe size reduction found — original PDF kept.",
      });
      return fallback;
    }

    const savingsBytes = input.size - candidateSize;
    const savingsPercent = percent(savingsBytes, input.size);

    emit({
      status: "processing",
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: candidateSize,
      savingsBytes,
      savingsPercent,
      message: "Validating optimized PDF…",
    });

    const validation = await validatePdfCandidate(input, candidate);
    if (!validation.valid) {
      console.warn("PDF optimization validation rejected candidate:", validation.reason);
      const fallback = originalResult(input, "failed");
      emit({
        ...fallback,
        fileName: input.name,
        validationReason: validation.reason,
        message: "Compression rejected by safety checks — original PDF kept.",
      });
      onProgress?.("Compression rejected by safety checks; uploading the original PDF.");
      return fallback;
    }

    const optimizedFile = new File([candidate], input.name, {
      type: PDF_MIME,
      lastModified: input.lastModified,
    });

    const optimizedResult: OptimizationResult = {
      file: optimizedFile,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes: input.size - optimizedFile.size,
      savingsPercent: percent(input.size - optimizedFile.size, input.size),
      optimized: true,
      status: "optimized",
      engine: "qpdf-wasm",
    };

    onProgress?.("Optimization verified. Preparing upload…");
    emit({
      ...optimizedResult,
      file: undefined,
      fileName: input.name,
      message: "Optimization successful and verified.",
    });

    return optimizedResult;
  } catch (error) {
    console.warn("PDF optimization skipped; uploading original file.", error);
    const fallback = originalResult(input, "failed");
    const reason = error instanceof Error ? error.message : "unknown optimization error";

    onProgress?.("Optimization failed; uploading the original PDF.");
    emit({
      ...fallback,
      file: undefined,
      fileName: input.name,
      validationReason: reason,
      message: "Optimization failed — original PDF uploaded instead.",
    });

    return fallback;
  }
}
