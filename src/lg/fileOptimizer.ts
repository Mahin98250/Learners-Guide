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
  engine: "safe-pdf" | "original";
};

const PDF_MIME = "application/pdf";
const MIN_INPUT_BYTES = 512 * 1024;
const MAX_IMAGE_DIMENSION = 2000;

const percent = (saved: number, original: number) =>
  original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;

const emit = (detail: Record<string, unknown>) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lg:pdf-optimization", { detail }));
  }
};

type PdfValidation = { valid: boolean; reason?: string };

type ImageCandidate = {
  ref: unknown;
  stream: any;
  width: number;
  height: number;
  data: Uint8Array;
};

/**
 * Re-open the candidate and verify the invariants that matter to users.
 * We intentionally do not compare PDF metadata, object numbering, rotation,
 * page boxes, or byte layout because a valid PDF optimizer may rewrite them.
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
      PDFDocument.load(inputBytes, { updateMetadata: false, ignoreEncryption: true }),
      PDFDocument.load(candidateBytes, { updateMetadata: false, ignoreEncryption: true }),
    ]);
  } catch (error) {
    return {
      valid: false,
      reason: `optimized PDF could not be reopened: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  if (source.getPageCount() !== optimized.getPageCount()) {
    return {
      valid: false,
      reason: `page count changed (${source.getPageCount()} → ${optimized.getPageCount()})`,
    };
  }

  for (const page of optimized.getPages()) {
    if (!Number.isFinite(page.getWidth()) || !Number.isFinite(page.getHeight()) || page.getWidth() <= 0 || page.getHeight() <= 0) {
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

function isSimpleColorSpace(value: any) {
  const text = value?.toString?.() ?? "";
  return text === "/DeviceRGB" || text === "/DeviceGray" || text === "/DeviceCMYK";
}

/**
 * Safely recompress JPEG image XObjects.
 *
 * The previous third-party engine could replace an image stream while keeping
 * the old Width/Height/ColorSpace/Filter dictionary. That can create a PDF
 * that cannot be reopened. This implementation updates the complete image
 * dictionary whenever an image is replaced, and skips images whose masks or
 * uncommon encodings need special handling.
 */
async function collectSafeJpegCandidates(
  pdfDoc: PDFDocument,
  PDFName: any,
): Promise<ImageCandidate[]> {
  const candidates: ImageCandidate[] = [];
  const objects = pdfDoc.context.enumerateIndirectObjects();

  for (const [ref, obj] of objects) {
    try {
      if (!obj || typeof obj !== "object" || !("dict" in obj) || !("getContents" in obj)) continue;
      const dict = (obj as any).dict;
      if (!dict?.has?.(PDFName.of("Type")) || dict.get(PDFName.of("Type"))?.toString() !== "/XObject") continue;
      if (!dict.has(PDFName.of("Subtype")) || dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;

      // Images with transparency/masks or uncommon color spaces are left alone.
      if (dict.has(PDFName.of("SMask")) || dict.has(PDFName.of("Mask")) || dict.has(PDFName.of("Decode"))) continue;
      const colorSpace = dict.get(PDFName.of("ColorSpace"));
      if (!isSimpleColorSpace(colorSpace)) continue;

      const filter = dict.has(PDFName.of("Filter")) ? dict.get(PDFName.of("Filter"))?.toString() ?? "" : "";
      if (filter !== "/DCTDecode") continue;

      const width = Number(dict.get(PDFName.of("Width"))?.asNumber?.() ?? 0);
      const height = Number(dict.get(PDFName.of("Height"))?.asNumber?.() ?? 0);
      const data = (obj as any).getContents?.();
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;
      if (!(data instanceof Uint8Array) || data.length === 0) continue;

      candidates.push({ ref, stream: obj, width, height, data });
    } catch {
      // An unusual object should never abort the complete upload.
    }
  }

  return candidates;
}

async function buildOptimizedPdf(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<Blob> {
  const { PDFName, PDFRawStream } = await import("pdf-lib");
  const bytes = await input.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const images = await collectSafeJpegCandidates(pdfDoc, PDFName);

  let processed = 0;
  let replaced = 0;

  for (const image of images) {
    try {
      onProgress?.(`Optimizing image ${processed + 1} of ${images.length}…`);

      const bitmap = await createImageBitmap(new Blob([image.data], { type: "image/jpeg" }));
      const sourceWidth = bitmap.width;
      const sourceHeight = bitmap.height;
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
      const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
      const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        bitmap.close();
        processed += 1;
        continue;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      bitmap.close();

      const jpeg = await new Promise<Uint8Array | null>((resolve) => {
        canvas.toBlob(async (blob) => {
          resolve(blob ? new Uint8Array(await blob.arrayBuffer()) : null);
        }, "image/jpeg", 0.85);
      });
      canvas.width = 1;
      canvas.height = 1;

      if (!jpeg || jpeg.length >= image.data.length) {
        processed += 1;
        continue;
      }

      const originalDict = (image.stream as any).dict;
      const nextDict = originalDict.clone();
      nextDict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
      nextDict.set(PDFName.of("Width"), pdfDoc.context.obj(targetWidth));
      nextDict.set(PDFName.of("Height"), pdfDoc.context.obj(targetHeight));
      nextDict.set(PDFName.of("BitsPerComponent"), pdfDoc.context.obj(8));
      nextDict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
      nextDict.delete(PDFName.of("DecodeParms"));

      const replacement = PDFRawStream.of(nextDict, jpeg);
      pdfDoc.context.assign(image.ref as any, replacement);
      replaced += 1;
    } catch (error) {
      console.warn("Skipping one PDF image during safe optimization", error);
    }

    processed += 1;
    const pct = images.length > 0 ? Math.round((processed / images.length) * 85) : 70;
    onProgress?.(`Optimizing images ${pct}%`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  onProgress?.(`Saving optimized PDF (${replaced} images updated)…`);
  const output = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  return new Blob([new Uint8Array(output)], { type: PDF_MIME });
}

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

    const candidate = await buildOptimizedPdf(input, onProgress);
    if (candidate.size <= 0 || candidate.size >= input.size) {
      const fallback = originalResult(input, "original-kept");
      emit({
        ...fallback,
        fileName: input.name,
        message: "No safe size reduction found — original PDF kept.",
      });
      return fallback;
    }

    const savingsBytes = input.size - candidate.size;
    const savingsPercent = percent(savingsBytes, input.size);
    onProgress?.("Validating optimized PDF…");
    emit({
      status: "processing",
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: candidate.size,
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
      engine: "safe-pdf",
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
