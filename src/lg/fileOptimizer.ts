import { compressPDF } from "@fileslim/compress";

export type OptimizationProgress = (message: string) => void;

export type OptimizationResult = {
  file: File;
  originalSize: number;
  optimizedSize: number;
  savingsBytes: number;
  savingsPercent: number;
  optimized: boolean;
  engine: "fileslim-pdf" | "original";
};

const PDF_MIME = "application/pdf";
const MIN_INPUT_BYTES = 512 * 1024;

const percent = (saved: number, original: number) =>
  original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;

/**
 * Safely optimizes a PDF before it reaches Storage.
 *
 * The optimizer only accepts the generated candidate when it is smaller.
 * FileSlim's PDF pipeline recompresses embedded images and keeps the PDF
 * structure/content rather than rasterizing every page. Metadata is retained.
 * If the optimizer cannot process a document, the original file is returned.
 */
export async function optimizePdfFile(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<OptimizationResult> {
  if (input.type !== PDF_MIME && !input.name.toLowerCase().endsWith(".pdf")) {
    return {
      file: input,
      originalSize: input.size,
      optimizedSize: input.size,
      savingsBytes: 0,
      savingsPercent: 0,
      optimized: false,
      engine: "original",
    };
  }

  if (input.size < MIN_INPUT_BYTES) {
    return {
      file: input,
      originalSize: input.size,
      optimizedSize: input.size,
      savingsBytes: 0,
      savingsPercent: 0,
      optimized: false,
      engine: "original",
    };
  }

  try {
    onProgress?.("Analyzing PDF…");
    const result = await compressPDF(input, {
      mode: "low",
      imageQuality: 0.85,
      maxImageDimension: 2000,
      stripMetadata: false,
      onProgress: (phase: string, pct: number) => {
        const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
        onProgress?.(`${phase} ${safePct}%`);
      },
    });

    const candidate = result.blob;
    const candidateSize = candidate.size;

    // Never replace a file with an equal/larger candidate.
    if (candidateSize <= 0 || candidateSize >= input.size) {
      return {
        file: input,
        originalSize: input.size,
        optimizedSize: input.size,
        savingsBytes: 0,
        savingsPercent: 0,
        optimized: false,
        engine: "original",
      };
    }

    onProgress?.("Optimization verified. Preparing upload…");
    const optimizedFile = new File([candidate], input.name, {
      type: PDF_MIME,
      lastModified: input.lastModified,
    });
    const savingsBytes = input.size - optimizedFile.size;

    return {
      file: optimizedFile,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes,
      savingsPercent: percent(savingsBytes, input.size),
      optimized: true,
      engine: "fileslim-pdf",
    };
  } catch (error) {
    console.warn("PDF optimization skipped; uploading original file.", error);
    onProgress?.("Optimization skipped; uploading the original PDF.");
    return {
      file: input,
      originalSize: input.size,
      optimizedSize: input.size,
      savingsBytes: 0,
      savingsPercent: 0,
      optimized: false,
      engine: "original",
    };
  }
}
