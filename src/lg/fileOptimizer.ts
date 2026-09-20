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
const JPEG_QUALITY_LEVELS = [60, 40] as const;

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
  qpdf: QpdfRunner,
  bytes: Uint8Array,
  label: string,
): Promise<PdfInspection> {
  try {
    // qpdf-run supports stdout-only inspection commands when the outputs
    // property is omitted. Do not provide outputs: [] because some runner
    // builds interpret an empty output declaration as a missing output file.
    const result = await qpdf.run({
      inputs: { "input.pdf": bytes },
      args: ["--warning-exit-0", "--show-npages", "input.pdf"],
    });

    if (result.exitCode !== 0 && result.exitCode !== 3) {
      return {
        valid: false,
        pageCount: 0,
        reason: `${label} page inspection failed with qpdf exit code ${result.exitCode}: ${[...result.stderr, ...result.stdout].join(" ").trim() || "no diagnostic"}`,
      };
    }

    const rawPageCount = result.stdout.join("\n").trim();
    const pageCount = Number(rawPageCount);
    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      return {
        valid: false,
        pageCount: 0,
        reason: `${label} returned an invalid page count: ${rawPageCount || "empty output"}`,
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
    const source = await inspectPdf(qpdf, bytes, "Source PDF");
    if (!source.valid) {
      throw new Error(source.reason || "Source PDF could not be inspected safely");
    }

    const candidates: Array<{ bytes: Uint8Array; inspection: PdfInspection }> = [];

    for (const quality of JPEG_QUALITY_LEVELS) {
      onProgress?.(`Compressing images at quality ${quality}…`);
      const candidate = await qpdf.runOne({
        input: bytes,
        inputName: "input.pdf",
        outputName: `optimized-${quality}.pdf`,
        args: [
          "--warning-exit-0",
          "--compress-streams=y",
          "--decode-level=generalized",
          "--recompress-flate",
          "--compression-level=9",
          "--object-streams=generate",
          "--optimize-images",
          `--jpeg-quality=${quality}`,
          "--",
          "input.pdf",
          `optimized-${quality}.pdf`,
        ],
      });

      if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
        continue;
      }

      const inspection = await inspectPdf(qpdf, candidate, `Optimized PDF (quality ${quality})`);
      if (inspection.valid && inspection.pageCount === source.pageCount) {
        candidates.push({ bytes: candidate, inspection });
      }
    }

    if (!candidates.length) {
      throw new Error("qpdf produced no candidate with the original page count");
    }

    return candidates.reduce((smallest, candidate) =>
      candidate.bytes.byteLength < smallest.bytes.byteLength ? candidate : smallest,
    );
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
    const fallback = originalResult(input, "failed");
    const reason = error instanceof Error ? error.message : String(error);
    onProgress?.("Optimization failed; uploading the original PDF.");
    emit({
      ...fallback,
      file: undefined,
      fileName: input.name,
      validationReason: reason,
      message: "Optimization failed — uploading the original PDF.",
    });
    return fallback;
  }
}
