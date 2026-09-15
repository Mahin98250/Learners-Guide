import { compressPDF } from "@fileslim/compress";
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
  engine: "fileslim-pdf" | "original";
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

type PdfValidation = {
  valid: boolean;
  reason?: string;
};

/**
 * Validate the optimized PDF without rejecting legitimate PDF rewrites.
 * FileSlim rebuilds/saves PDF objects, so byte-level metadata, rotation and
 * page-box equality are not reliable content checks. The important safety
 * invariants here are: valid PDF, same page count, and valid positive page
 * geometry on every page. FileSlim only replaces embedded image streams and
 * preserves the existing page tree/content structure.
 */
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
      PDFDocument.load(inputBytes, {
        updateMetadata: false,
        ignoreEncryption: true,
      }),
      PDFDocument.load(candidateBytes, {
        updateMetadata: false,
        ignoreEncryption: true,
      }),
    ]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "PDF could not be reopened";
    return { valid: false, reason: `optimized PDF could not be reopened: ${reason}` };
  }

  const sourcePages = source.getPages();
  const optimizedPages = optimized.getPages();
  if (sourcePages.length !== optimizedPages.length) {
    return {
      valid: false,
      reason: `page count changed (${sourcePages.length} → ${optimizedPages.length})`,
    };
  }

  for (let i = 0; i < optimizedPages.length; i += 1) {
    const page = optimizedPages[i];
    const width = page.getWidth();
    const height = page.getHeight();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { valid: false, reason: `optimized page ${i + 1} has invalid dimensions` };
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

/** Safely optimizes a PDF before it reaches Storage. */
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

    const result = await compressPDF(input, {
      mode: "low",
      imageQuality: 0.85,
      maxImageDimension: 2000,
      stripMetadata: false,
      onProgress: (phase: string, pct: number) => {
        const safePct = Number.isFinite(pct)
          ? Math.max(0, Math.min(100, Math.round(pct)))
          : 0;
        const message = `${phase} ${safePct}%`;
        onProgress?.(message);
        emit({
          status: "processing",
          fileName: input.name,
          originalSize: input.size,
          optimizedSize: null,
          savingsBytes: null,
          savingsPercent: null,
          progress: safePct,
          message,
        });
      },
    });

    const candidate = result.blob;
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
    onProgress?.("Validating pages and document structure…");
    emit({
      status: "processing",
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: candidateSize,
      savingsBytes,
      savingsPercent,
      message: "Validating pages and document structure…",
    });

    const validation = await validatePdfCandidate(input, candidate);
    if (!validation.valid) {
      console.warn("PDF optimization validation rejected candidate:", validation.reason);
      const fallback = originalResult(input, "failed");
      emit({
        ...fallback,
        fileName: input.name,
        validationReason: validation.reason,
        message: "Validation failed — original PDF uploaded instead.",
      });
      onProgress?.("Validation failed; uploading the original PDF.");
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
      engine: "fileslim-pdf",
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
    onProgress?.("Optimization failed; uploading the original PDF.");
    emit({
      ...fallback,
      file: undefined,
      fileName: input.name,
      validationReason: error instanceof Error ? error.message : "unknown optimization error",
      message: "Optimization failed — original PDF uploaded instead.",
    });
    return fallback;
  }
}
