import { optimizePdfFile, type OptimizationProgress, type OptimizationResult } from "./fileOptimizer";

export type SupportedCompressionKind = "pdf" | "image" | "office" | "archive" | "other";

export type FileCompressionResult = OptimizationResult & {
  kind: SupportedCompressionKind;
};

const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const officeExtensions = new Set([
  ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".ods", ".odp",
]);

const archiveExtensions = new Set([
  ".zip", ".rar", ".7z", ".tar", ".gz",
]);

function extensionOf(file: File) {
  const name = file.name.toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}

export function getCompressionKind(file: File): SupportedCompressionKind {
  const extension = extensionOf(file);
  if (file.type === "application/pdf" || extension === ".pdf") return "pdf";
  if (imageTypes.has(file.type) || extension === ".jpg" || extension === ".jpeg" || extension === ".png" || extension === ".webp" || extension === ".avif") return "image";
  if (officeExtensions.has(extension)) return "office";
  if (archiveExtensions.has(extension)) return "archive";
  return "other";
}

export async function compressFile(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<FileCompressionResult> {
  const kind = getCompressionKind(input);

  if (kind === "pdf") {
    return { ...(await optimizePdfFile(input, onProgress)), kind };
  }

  // Non-PDF formats intentionally remain unchanged until a format-specific,
  // loss-safe browser optimizer is installed. Never rename or rewrite a file
  // merely to claim compression.
  return {
    file: input,
    originalSize: input.size,
    optimizedSize: input.size,
    savingsBytes: 0,
    savingsPercent: 0,
    optimized: false,
    status: "original-kept",
    engine: "original",
    kind,
  };
}
