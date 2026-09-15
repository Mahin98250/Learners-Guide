import { compressPDF } from "@fileslim/compress";
import { PDFDocument } from "pdf-lib";

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

const sameMetadata = (a: PDFDocument, b: PDFDocument) =>
  JSON.stringify([
    a.getTitle(), a.getAuthor(), a.getSubject(), a.getKeywords(),
    a.getCreator(), a.getProducer(), a.getCreationDate()?.toISOString() || null,
    a.getModificationDate()?.toISOString() || null,
  ]) === JSON.stringify([
    b.getTitle(), b.getAuthor(), b.getSubject(), b.getKeywords(),
    b.getCreator(), b.getProducer(), b.getCreationDate()?.toISOString() || null,
    b.getModificationDate()?.toISOString() || null,
  ]);

/**
 * Structural guardrail: the optimized candidate must remain a readable PDF,
 * keep the same page count and page dimensions, and retain document metadata.
 * If validation cannot prove that safely, the original is uploaded instead.
 */
async function validatePdfCandidate(input: File, candidate: Blob) {
  const [inputBytes, candidateBytes] = await Promise.all([input.arrayBuffer(), candidate.arrayBuffer()]);
  const [source, optimized] = await Promise.all([
    PDFDocument.load(inputBytes, { updateMetadata: false }),
    PDFDocument.load(candidateBytes, { updateMetadata: false }),
  ]);
  const sourcePages = source.getPages();
  const optimizedPages = optimized.getPages();
  if (sourcePages.length !== optimizedPages.length) return false;
  if (!sameMetadata(source, optimized)) return false;
  for (let i = 0; i < sourcePages.length; i += 1) {
    const a = sourcePages[i];
    const b = optimizedPages[i];
    if (Math.abs(a.getWidth() - b.getWidth()) > 0.01) return false;
    if (Math.abs(a.getHeight() - b.getHeight()) > 0.01) return false;
  }
  return true;
}

/**
 * Safely optimizes a PDF before it reaches Storage.
 *
 * The optimizer recompresses embedded images instead of rasterizing pages,
 * keeps metadata, validates the resulting PDF, and only accepts it when it is
 * both structurally valid and smaller. Any failure falls back to the original.
 */
export async function optimizePdfFile(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<OptimizationResult> {
  if (input.type !== PDF_MIME && !input.name.toLowerCase().endsWith(".pdf")) {
    return { file: input, originalSize: input.size, optimizedSize: input.size, savingsBytes: 0, savingsPercent: 0, optimized: false, engine: "original" };
  }

  if (input.size < MIN_INPUT_BYTES) {
    return { file: input, originalSize: input.size, optimizedSize: input.size, savingsBytes: 0, savingsPercent: 0, optimized: false, engine: "original" };
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
    if (candidateSize <= 0 || candidateSize >= input.size) {
      return { file: input, originalSize: input.size, optimizedSize: input.size, savingsBytes: 0, savingsPercent: 0, optimized: false, engine: "original" };
    }

    onProgress?.("Validating pages and document structure…");
    if (!(await validatePdfCandidate(input, candidate))) {
      onProgress?.("Validation failed; uploading the original PDF.");
      return { file: input, originalSize: input.size, optimizedSize: input.size, savingsBytes: 0, savingsPercent: 0, optimized: false, engine: "original" };
    }

    const optimizedFile = new File([candidate], input.name, { type: PDF_MIME, lastModified: input.lastModified });
    const savingsBytes = input.size - optimizedFile.size;
    onProgress?.("Optimization verified. Preparing upload…");
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
    return { file: input, originalSize: input.size, optimizedSize: input.size, savingsBytes: 0, savingsPercent: 0, optimized: false, engine: "original" };
  }
}
