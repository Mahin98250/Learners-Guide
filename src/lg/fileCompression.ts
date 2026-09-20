import { optimizePdfFile, type OptimizationProgress, type OptimizationResult } from "./fileOptimizer";

export type SupportedCompressionKind = "pdf" | "image" | "office" | "archive" | "other";
export type CompressionEngine = OptimizationResult["engine"] | "canvas" | "zip-repack";

export type FileCompressionResult = Omit<OptimizationResult, "engine"> & {
  engine: CompressionEngine;
  kind: SupportedCompressionKind;
};

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OOXML_EXTENSIONS = new Set([".docx", ".docm", ".pptx", ".pptm", ".xlsx", ".xlsm"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".tar", ".gz"]);
const MIN_IMAGE_BYTES = 256 * 1024;

function extensionOf(file: File): string {
  const name = file.name.toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}

function emit(detail: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lg:file-compression", { detail }));
  }
}

function originalResult(
  input: File,
  kind: SupportedCompressionKind,
  status: "original-kept" | "failed" = "original-kept",
): FileCompressionResult {
  return {
    file: input,
    originalSize: input.size,
    optimizedSize: input.size,
    savingsBytes: 0,
    savingsPercent: 0,
    optimized: false,
    status,
    engine: "original",
    kind,
  };
}

function savingsPercent(saved: number, original: number): number {
  return original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;
}

export function getCompressionKind(file: File): SupportedCompressionKind {
  const extension = extensionOf(file);
  if (file.type === "application/pdf" || extension === ".pdf") return "pdf";
  if (
    IMAGE_MIME_TYPES.has(file.type) ||
    extension === ".jpg" ||
    extension === ".jpeg" ||
    extension === ".webp"
  ) {
    return "image";
  }
  if (OOXML_EXTENSIONS.has(extension)) return "office";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  return "other";
}

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

async function optimizeImage(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<FileCompressionResult> {
  const kind: SupportedCompressionKind = "image";
  const extension = extensionOf(input);
  const mimeType: "image/jpeg" | "image/png" | "image/webp" | null =
    input.type === "image/jpeg" || input.type === "image/png" || input.type === "image/webp"
      ? input.type
      : extension === ".webp"
        ? "image/webp"
        : extension === ".png"
          ? "image/png"
          : extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : null;

  if (input.size < MIN_IMAGE_BYTES || !mimeType) {
    return originalResult(input, kind);
  }

  if (typeof document === "undefined" || typeof URL === "undefined") {
    return originalResult(input, kind);
  }

  const objectUrl = URL.createObjectURL(input);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = "async";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Browser could not decode the image"));
      element.src = objectUrl;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      return originalResult(input, kind);
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return originalResult(input, kind);

    context.drawImage(image, 0, 0);
    const qualities = [0.82, 0.68] as const;
    const candidates: Blob[] = [];

    for (const quality of qualities) {
      onProgress?.("Compressing image at quality " + Math.round(quality * 100) + "…");
      const candidate = await blobFromCanvas(canvas, mimeType, quality);
      if (candidate && candidate.size > 0 && candidate.size < input.size) {
        candidates.push(candidate);
      }
    }

    if (!candidates.length) return originalResult(input, kind);

    const smallest = candidates.reduce((best, candidate) =>
      candidate.size < best.size ? candidate : best,
    );

    const optimizedFile = new File([smallest], input.name, {
      type: mimeType,
      lastModified: input.lastModified,
    });
    const saved = input.size - optimizedFile.size;

    emit({
      status: "optimized",
      kind,
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes: saved,
      savingsPercent: savingsPercent(saved, input.size),
      message: "Image compressed successfully.",
    });

    return {
      file: optimizedFile,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes: saved,
      savingsPercent: savingsPercent(saved, input.size),
      optimized: true,
      status: "optimized",
      engine: "canvas",
      kind,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    emit({
      status: "failed",
      kind,
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: input.size,
      savingsBytes: 0,
      savingsPercent: 0,
      validationReason: reason,
      message: "Image compression failed — original kept.",
    });
    return originalResult(input, kind, "failed");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function requiredOfficeEntry(extension: string): string | null {
  if (extension === ".docx" || extension === ".docm") return "word/document.xml";
  if (extension === ".pptx" || extension === ".pptm") return "ppt/presentation.xml";
  if (extension === ".xlsx" || extension === ".xlsm") return "xl/workbook.xml";
  return null;
}

async function optimizeOfficeContainer(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<FileCompressionResult> {
  const kind: SupportedCompressionKind = "office";
  const extension = extensionOf(input);
  const requiredEntry = requiredOfficeEntry(extension);
  if (!requiredEntry) return originalResult(input, kind);

  try {
    onProgress?.("Repacking Office document safely…");
    const { unzipSync, zipSync } = await import("fflate");
    const sourceBytes = new Uint8Array(await input.arrayBuffer());
    const entries = unzipSync(sourceBytes);
    const names = Object.keys(entries);

    if (!entries["[Content_Types].xml"] || !entries[requiredEntry]) {
      return originalResult(input, kind, "failed");
    }

    // Rewriting a signed OOXML package invalidates its digital signature.
    if (names.some((name) => name.startsWith("_xmlsignatures/"))) {
      return originalResult(input, kind);
    }

    const repacked = zipSync(entries, { level: 9 });
    if (!(repacked instanceof Uint8Array) || repacked.byteLength >= input.size) {
      return originalResult(input, kind);
    }

    const roundTripped = unzipSync(repacked);
    const sourceNames = [...names].sort();
    const candidateNames = Object.keys(roundTripped).sort();
    if (
      sourceNames.length !== candidateNames.length ||
      sourceNames.some((name, index) => name !== candidateNames[index])
    ) {
      return originalResult(input, kind, "failed");
    }

    for (const name of names) {
      const source = entries[name];
      const candidate = roundTripped[name];
      if (!candidate || source.length !== candidate.length) {
        return originalResult(input, kind, "failed");
      }
      for (let index = 0; index < source.length; index += 1) {
        if (source[index] !== candidate[index]) {
          return originalResult(input, kind, "failed");
        }
      }
    }

    const optimizedFile = new File([repacked], input.name, {
      type: input.type || "application/octet-stream",
      lastModified: input.lastModified,
    });
    const saved = input.size - optimizedFile.size;

    emit({
      status: "optimized",
      kind,
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes: saved,
      savingsPercent: savingsPercent(saved, input.size),
      message: "Office document repacked and verified.",
    });

    return {
      file: optimizedFile,
      originalSize: input.size,
      optimizedSize: optimizedFile.size,
      savingsBytes: saved,
      savingsPercent: savingsPercent(saved, input.size),
      optimized: true,
      status: "optimized",
      engine: "zip-repack",
      kind,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    emit({
      status: "failed",
      kind,
      fileName: input.name,
      originalSize: input.size,
      optimizedSize: input.size,
      savingsBytes: 0,
      savingsPercent: 0,
      validationReason: reason,
      message: "Office compression failed — original kept.",
    });
    return originalResult(input, kind, "failed");
  }
}

export async function compressFile(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<FileCompressionResult> {
  const kind = getCompressionKind(input);
  if (kind === "pdf") {
    return { ...(await optimizePdfFile(input, onProgress)), kind };
  }
  if (kind === "image") {
    return optimizeImage(input, onProgress);
  }
  if (kind === "office") {
    return optimizeOfficeContainer(input, onProgress);
  }

  // Archives and legacy/unknown formats are intentionally left untouched.
  // Never rename, transcode, or recompress an unsupported format merely to
  // claim compression.
  return originalResult(input, kind);
}
