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

type PdfCheck = { valid: boolean; pageCount: number; reason?: string };

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

async function checkPdf(
  qpdf: QpdfRunner,
  bytes: Uint8Array,
  name: string,
): Promise<PdfCheck> {
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (header !== "%PDF-") {
    return { valid: false, pageCount: 0, reason: "output does not start with a PDF header" };
  }

  const check = await qpdf.run({
    inputs: { [name]: bytes },
    args: ["--check", name],
  });

  // qpdf exit code 3 means warnings; the file can still be usable.
  if (check.exitCode !== 0 && check.exitCode !== 3) {
    return {
      valid: false,
      pageCount: 0,
      reason: `qpdf check failed (exit ${check.exitCode ?? "unknown"}): ${[...check.stderr, ...check.stdout].join(" ").trim() || "no diagnostic"}`,
    };
  }

  const pages = await qpdf.run({
    inputs: { [name]: bytes },
    args: ["--show-npages", name],
  });
  const pageText = pages.stdout.join("\n").trim();
  const match = pageText.match(/^\s*(\d+)\s*$/m);
  if (!match) {
    return {
      valid: false,
      pageCount: 0,
      reason: `qpdf could not determine page count: ${[...pages.stderr, ...pages.stdout].join(" ").trim() || "no diagnostic"}`,
    };
  }

  return { valid: true, pageCount: Number(match[1]) };
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
): Promise<{ bytes: Uint8Array; validation: PdfCheck } | null> {
  const qpdf = await createQpdfRunnerForFile(input.size);
  try {
    const bytes = new Uint8Array(await input.arrayBuffer());
    const source = await checkPdf(qpdf, bytes, "source.pdf");
    if (!source.valid) {
      throw new Error(`source PDF failed qpdf validation: ${source.reason}`);
    }

    // Pass 1: lossless/structural optimization. This is the reliable baseline.
    onProgress?.("Optimizing PDF structure…");
    const structural = await qpdf.runOne({
      input: bytes,
      inputName: "input.pdf",
      outputName: "structural.pdf",
      args: [
        "--compress-streams=y",
        "--decode-level=generalized",
        "--recompress-flate",
        "--compression-level=9",
        "--object-streams=generate",
        "--",
        "input.pdf",
        "structural.pdf",
      ],
    });

    const structuralCheck = await checkPdf(qpdf, structural, "structural.pdf");
    const candidates: Array<{ bytes: Uint8Array; validation: PdfCheck }> = [];
    if (structuralCheck.valid && structuralCheck.pageCount === source.pageCount) {
      candidates.push({ bytes: structural, validation: structuralCheck });
    }

    // Pass 2: image optimization. qpdf decides whether replacing an image is
    // actually smaller, so we do not force a quality setting that may be
    // unsupported by the bundled qpdf version or unnecessarily degrade content.
    onProgress?.("Optimizing embedded images…");
    const imageOptimized = await qpdf.runOne({
      input: bytes,
      inputName: "input.pdf",
      outputName: "images.pdf",
      args: [
        "--compress-streams=y",
        "--decode-level=generalized",
        "--recompress-flate",
        "--compression-level=9",
        "--object-streams=generate",
        "--optimize-images",
        "--",
        "input.pdf",
        "images.pdf",
      ],
    });

    const imageCheck = await checkPdf(qpdf, imageOptimized, "images.pdf");
    if (imageCheck.valid && imageCheck.pageCount === source.pageCount) {
      candidates.push({ bytes: imageOptimized, validation: imageCheck });
    }

    if (!candidates.length) {
      throw new Error("qpdf produced no valid candidate with the original page count");
    }

    const best = candidates.reduce((smallest, candidate) =>
      candidate.bytes.byteLength < smallest.bytes.byteLength ? candidate : smallest,
    );

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

    const optimizedFile = new File([optimized.bytes], input.name, {
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
