import { PDFDocument } from "pdf-lib";
import type { QpdfRunner } from "qpdf-run";

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
const MIN_INPUT_BYTES = 256 * 1024;

type PdfInspection = {
  valid: boolean;
  pageCount: number;
  reason?: string;
};

const percent = (saved: number, original: number) =>
  original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;

const emit = (detail: Record<string, unknown>) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lg:pdf-optimization", { detail }));
  }
};

async function createQpdfRunnerForFile(inputSize: number): Promise<QpdfRunner> {
  const { createQpdfRunner } = await import("qpdf-run");
  const workerUrl = new URL("qpdf-run/worker", import.meta.url).href;
  const qpdfJsUrl = new URL("qpdf-run/qpdf.js", import.meta.url).href;
  const wasmUrl = new URL("qpdf-run/qpdf.wasm", import.meta.url).href;

  return createQpdfRunner({
    workerUrl,
    qpdfJsUrl,
    wasmUrl,
    timeoutMs: Math.max(
      60_000,
      Math.min(180_000, 30_000 + Math.ceil(inputSize / (1024 * 1024)) * 5_000),
    ),
  });
}

async function inspectPdf(
  bytes: Uint8Array,
  label: string,
): Promise<PdfInspection> {
  try {
    // qpdf-run 0.2.1 does not reliably support stdout-only inspection in all
    // builds, so page-count validation is handled by the already-installed
    // pdf-lib dependency. qpdf itself remains responsible for transformation.
    const pdf = await PDFDocument.load(bytes);
    const pageCount = pdf.getPageCount();
    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      return {
        valid: false,
        pageCount: 0,
        reason: `${label} returned an invalid page count: ${pageCount}`,
      };
    }
    return { valid: true, pageCount };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { valid: false, pageCount: 0, reason: `${label} inspection failed: ${reason}` };
  }
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

async function optimizeWithQpdf(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<{ bytes: Uint8Array; inspection: PdfInspection } | null> {
  const qpdf = await createQpdfRunnerForFile(input.size);
  try {
    const bytes = new Uint8Array(await input.arrayBuffer());
    const source = await inspectPdf(bytes, "Source PDF");
    if (!source.valid) {
      throw new Error(source.reason || "Source PDF could not be inspected safely");
    }

    onProgress?.("Compressing PDF streams and images…");
    const candidateName = "optimized.pdf";
    const candidate = await qpdf.runOne({
      input: bytes,
      inputName: "input.pdf",
      outputName: candidateName,
      args: [
        "--warning-exit-0",
        "--compress-streams=y",
        "--decode-level=generalized",
        "--recompress-flate",
        "--compression-level=9",
        "--object-streams=generate",
        "--optimize-images",
        "--",
        "input.pdf",
        candidateName,
      ],
    });

    if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
      throw new Error("qpdf produced an empty optimized PDF");
    }

    const inspection = await inspectPdf(candidate, "Optimized PDF");
    if (!inspection.valid || inspection.pageCount !== source.pageCount) {
      throw new Error(
        inspection.reason || "Optimized PDF failed page-count validation",
      );
    }

    return { bytes: candidate, inspection };
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

    const optimized = await optimizeWithQpdf(input, onProgress);
    if (!optimized) {
      return originalResult(input, "original-kept");
    }

    const candidateSize = optimized.bytes.byteLength;
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
      message: "Optimized PDF verified — preparing upload…",
    });
    onProgress?.("Optimization verified. Preparing upload…");

    const optimizedBuffer = new ArrayBuffer(optimized.bytes.byteLength);
    new Uint8Array(optimizedBuffer).set(optimized.bytes);
    const optimizedFile = new File([optimizedBuffer], input.name, {
      type: PDF_MIME,
      lastModified: input.lastModified,
    });

    const result: OptimizationResult = {
      file: optimizedFile,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes: input.size - optimizedFile.size,
      savingsPercent: percent(input.size - optimizedFile.size, input.size),
      optimized: true,
      status: "optimized",
      engine: "qpdf-wasm",
    };

    emit({
      ...result,
      file: undefined,
      fileName: input.name,
      message: "Optimization successful and verified.",
    });
    return result;
  } catch (error) {
    console.warn("PDF optimization skipped; uploading original file.", error);
    const fallback = originalResult(input, "original-kept");
    const reason = error instanceof Error ? error.message : String(error);
    onProgress?.("Optimization could not be applied; uploading the original PDF.");
    emit({
      ...fallback,
      file: undefined,
      fileName: input.name,
      validationReason: reason,
      message: "Optimization could not be applied — the original PDF is kept safely.",
    });
    return fallback;
  }
}
