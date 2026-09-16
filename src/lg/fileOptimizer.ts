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
const MIN_INPUT_BYTES = 512 * 1024;

const percent = (saved: number, original: number) =>
  original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;

const emit = (detail: Record<string, unknown>) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lg:pdf-optimization", { detail }));
  }
};

type PdfValidation = { valid: boolean; reason?: string };

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
      Math.min(180_000, 20_000 + Math.ceil(inputSize / (1024 * 1024)) * 2_500),
    ),
  });
}

async function qpdfCheck(
  qpdf: QpdfRunner,
  bytes: Uint8Array,
  name: string,
): Promise<{ pageCount: number }> {
  const check = await qpdf.run({
    inputs: { [name]: bytes },
    args: ["--check", name],
  });

  if (check.exitCode !== 0 && check.exitCode !== 3) {
    throw new Error(
      `qpdf check failed (exit ${check.exitCode ?? "unknown"}): ${[...check.stderr, ...check.stdout].join(" ").trim() || "no diagnostic"}`,
    );
  }

  const pageResult = await qpdf.run({
    inputs: { [name]: bytes },
    args: ["--show-npages", name],
  });

  const pageText = pageResult.stdout.join("\n").trim();
  const match = pageText.match(/^\s*(\d+)\s*$/m);
  if (!match) {
    throw new Error(
      `qpdf could not determine page count: ${[...pageResult.stderr, ...pageResult.stdout].join(" ").trim() || "no diagnostic"}`,
    );
  }

  return { pageCount: Number(match[1]) };
}

/**
 * Validate with the same PDF engine that produced the candidate.
 * pdf-lib is deliberately not used here because it can reject valid PDFs
 * containing structures/features it does not fully support.
 */
async function validatePdfCandidate(
  inputBytes: Uint8Array,
  candidateBytes: Uint8Array,
  inputSize: number,
): Promise<PdfValidation> {
  const header = new TextDecoder("ascii").decode(candidateBytes.slice(0, 5));
  if (header !== "%PDF-") {
    return { valid: false, reason: "optimized output is not a PDF" };
  }

  const qpdf = await createQpdfRunnerForFile(inputSize);
  try {
    const source = await qpdfCheck(qpdf, inputBytes, "source.pdf");
    const candidate = await qpdfCheck(qpdf, candidateBytes, "candidate.pdf");

    if (candidate.pageCount !== source.pageCount) {
      return {
        valid: false,
        reason: `page count changed (${source.pageCount} → ${candidate.pageCount})`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "qpdf validation failed",
    };
  } finally {
    await qpdf.destroy();
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

async function qpdfOptimize(input: File, onProgress?: OptimizationProgress): Promise<Uint8Array> {
  const qpdf = await createQpdfRunnerForFile(input.size);

  try {
    onProgress?.("Starting safe PDF optimizer…");
    const bytes = new Uint8Array(await input.arrayBuffer());
    const baseArgs = [
      "--compress-streams=y",
      "--decode-level=generalized",
      "--recompress-flate",
      "--compression-level=9",
      "--object-streams=generate",
      "--optimize-images",
    ];

    const runProfile = async (jpegQuality: number) => {
      const result = await qpdf.runOne({
        input: bytes,
        inputName: "input.pdf",
        outputName: "output.pdf",
        args: [
          ...baseArgs,
          `--jpeg-quality=${jpegQuality}`,
          "--",
          "input.pdf",
          "output.pdf",
        ],
      });
      if (!(result instanceof Uint8Array) || result.length === 0) {
        throw new Error(`qpdf returned no output at JPEG quality ${jpegQuality}`);
      }
      return result;
    };

    const highQuality = await runProfile(85);
    if (highQuality.byteLength < input.size) {
      onProgress?.("Safe PDF optimization completed at high quality.");
      return highQuality;
    }

    onProgress?.("Trying stronger image compression because the first pass did not reduce the file…");
    const stronger = await runProfile(75);
    const best = stronger.byteLength < highQuality.byteLength ? stronger : highQuality;
    onProgress?.("Safe PDF optimization completed.");
    return best;
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

    const inputBytes = new Uint8Array(await input.arrayBuffer());
    const candidateBytes = await qpdfOptimize(input, onProgress);
    const candidateSize = candidateBytes.byteLength;

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
      message: "Validating optimized PDF with qpdf…",
    });
    onProgress?.("Validating optimized PDF with qpdf…");

    const validation = await validatePdfCandidate(inputBytes, candidateBytes, input.size);
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

    const optimizedFile = new File([candidateBytes], input.name, {
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
