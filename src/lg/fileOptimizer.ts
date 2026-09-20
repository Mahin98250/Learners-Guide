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
  engine: "ghostscript-wasm" | "qpdf-wasm" | "original";
  compressionProfile?: "extreme" | "recommended" | "less";
};

const PDF_MIME = "application/pdf";
const MIN_INPUT_BYTES = 256 * 1024;
const EXTREME_FALLBACK_THRESHOLD = 0.1;

type PdfInspection = {
  valid: boolean;
  pageCount: number;
  reason?: string;
};

type GhostscriptFile = {
  name: string;
  data: Uint8Array;
};

type GhostscriptResult = {
  files?: GhostscriptFile[];
};

type GhostscriptRunner = {
  exec: (
    args: string[],
    options: {
      files: Array<{ name: string; data: Uint8Array }>;
      dirs?: string[];
      outputs?: string[];
    },
  ) => Promise<GhostscriptResult>;
  dispose: () => void;
};

type CompressionProfile = {
  label: "extreme" | "recommended" | "less";
  pdfSettings: "/screen" | "/ebook" | "/printer";
  description: string;
};

const COMPRESSION_PROFILES: CompressionProfile[] = [
  {
    label: "recommended",
    pdfSettings: "/ebook",
    description: "Good quality and strong compression",
  },
  {
    label: "extreme",
    pdfSettings: "/screen",
    description: "Maximum practical compression with lower image quality",
  },
  {
    label: "less",
    pdfSettings: "/printer",
    description: "High quality with lighter compression",
  },
];

const percent = (saved: number, original: number) =>
  original > 0 ? Math.max(0, Math.round((saved / original) * 1000) / 10) : 0;

const emit = (detail: Record<string, unknown>) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lg:pdf-optimization", { detail }));
  }
};

async function inspectPdf(
  bytes: Uint8Array,
  label: string,
): Promise<PdfInspection> {
  try {
    const { PDFDocument } = await import("pdf-lib");
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
    return {
      valid: false,
      pageCount: 0,
      reason: `${label} inspection failed: ${reason}`,
    };
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

async function optimizeWithGhostscript(
  bytes: Uint8Array,
  source: PdfInspection,
  onProgress?: OptimizationProgress,
): Promise<{
  bytes: Uint8Array;
  inspection: PdfInspection;
  profile: CompressionProfile;
} | null> {
  const { load } = await import("@wasm-zoo/ghostscript");
  const gs = (await load()) as unknown as GhostscriptRunner;
  const candidates: Array<{
    bytes: Uint8Array;
    inspection: PdfInspection;
    profile: CompressionProfile;
  }> = [];

  try {
    for (const profile of COMPRESSION_PROFILES) {
      onProgress?.(
        `Powerful PDF compression: ${profile.label} mode (${profile.description})…`,
      );

      const outputName = `/out/optimized-${profile.label}.pdf`;
      const result = await gs.exec(
        [
          "-dSAFER",
          "-dBATCH",
          "-dNOPAUSE",
          "-dQUIET",
          "-sDEVICE=pdfwrite",
          "-dCompatibilityLevel=1.4",
          `-dPDFSETTINGS=${profile.pdfSettings}`,
          "-dDetectDuplicateImages=true",
          "-dCompressFonts=true",
          "-dSubsetFonts=true",
          "-dEmbedAllFonts=true",
          "-dPreserveAnnots=true",
          "-dPreserveMarkedContent=true",
          "-sOutputFile=" + outputName,
          "/input.pdf",
        ],
        {
          files: [{ name: "/input.pdf", data: bytes }],
          dirs: ["/out"],
          outputs: [outputName],
        },
      );

      const output = result.files?.find((file) => file.name === outputName)?.data;
      if (!(output instanceof Uint8Array) || output.byteLength === 0) {
        continue;
      }

      const inspection = await inspectPdf(
        output,
        `Ghostscript ${profile.label} PDF`,
      );
      if (!inspection.valid || inspection.pageCount !== source.pageCount) {
        continue;
      }

      if (output.byteLength < bytes.byteLength) {
        candidates.push({ bytes: output, inspection, profile });
      }

      if (
        profile.label === "recommended" &&
        output.byteLength <= bytes.byteLength * (1 - EXTREME_FALLBACK_THRESHOLD)
      ) {
        break;
      }
    }
  } finally {
    gs.dispose();
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((smallest, candidate) =>
    candidate.bytes.byteLength < smallest.bytes.byteLength ? candidate : smallest,
  );
}

async function optimizeWithQpdf(
  input: File,
  source: PdfInspection,
  onProgress?: OptimizationProgress,
): Promise<{ bytes: Uint8Array; inspection: PdfInspection } | null> {
  const bytes = new Uint8Array(await input.arrayBuffer());
  const strategies = [
    {
      label: "image-aware",
      args: [
        "--compress-streams=y",
        "--decode-level=generalized",
        "--recompress-flate",
        "--compression-level=9",
        "--object-streams=generate",
        "--optimize-images",
      ],
    },
    {
      label: "conservative",
      args: ["--compress-streams=y", "--object-streams=generate"],
    },
  ] as const;

  let lastError: unknown = null;

  for (const strategy of strategies) {
    let qpdf: QpdfRunner | null = null;

    try {
      qpdf = await createQpdfRunnerForFile(input.size);
      onProgress?.(
        strategy.label === "image-aware"
          ? "Running structural PDF optimization fallback…"
          : "Retrying with a conservative PDF compression pass…",
      );

      const candidateName = `optimized-${strategy.label}.pdf`;
      const candidate = await qpdf.runOne({
        input: bytes,
        inputName: "input.pdf",
        outputName: candidateName,
        args: [
          ...strategy.args,
          "--",
          "input.pdf",
          candidateName,
        ],
      });

      if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
        throw new Error(`qpdf produced an empty ${strategy.label} PDF`);
      }

      const inspection = await inspectPdf(
        candidate,
        `Optimized PDF (${strategy.label})`,
      );
      if (!inspection.valid || inspection.pageCount !== source.pageCount) {
        throw new Error(
          inspection.reason ||
            `Optimized PDF (${strategy.label}) failed page-count validation`,
        );
      }

      if (candidate.byteLength < bytes.byteLength) {
        return { bytes: candidate, inspection };
      }

      lastError = new Error(
        `The ${strategy.label} compression pass was valid but did not reduce the file size`,
      );
    } catch (error) {
      lastError = error;
    } finally {
      if (qpdf) {
        await qpdf.destroy().catch(() => undefined);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("qpdf could not produce a safe smaller PDF");
}

async function optimizePdfBytes(
  input: File,
  onProgress?: OptimizationProgress,
): Promise<{
  bytes: Uint8Array;
  inspection: PdfInspection;
  engine: "ghostscript-wasm" | "qpdf-wasm";
  compressionProfile?: CompressionProfile["label"];
}> {
  const bytes = new Uint8Array(await input.arrayBuffer());
  const source = await inspectPdf(bytes, "Source PDF");

  if (!source.valid) {
    throw new Error(source.reason || "Source PDF could not be inspected safely");
  }

  try {
    const ghostscript = await optimizeWithGhostscript(
      bytes,
      source,
      onProgress,
    );

    if (ghostscript) {
      return {
        bytes: ghostscript.bytes,
        inspection: ghostscript.inspection,
        engine: "ghostscript-wasm",
        compressionProfile: ghostscript.profile.label,
      };
    }
  } catch (error) {
    console.warn("Ghostscript PDF compression failed; trying qpdf fallback.", error);
  }

  const qpdf = await optimizeWithQpdf(input, source, onProgress);
  if (!qpdf) {
    throw new Error("No safe smaller PDF candidate was produced");
  }

  return {
    ...qpdf,
    engine: "qpdf-wasm",
  };
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

    const optimized = await optimizePdfBytes(input, onProgress);
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
      engine: optimized.engine,
      compressionProfile: optimized.compressionProfile,
      message: "Powerful PDF compression verified — preparing upload…",
    });
    onProgress?.("Compression verified. Preparing upload…");

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
      engine: optimized.engine,
      compressionProfile: optimized.compressionProfile,
    };

    emit({
      ...result,
      file: undefined,
      fileName: input.name,
      message: "Powerful compression successful and verified.",
    });

    return result;
  } catch (error) {
    console.warn("PDF optimization skipped; uploading original file.", error);
    const fallback = originalResult(input, "original-kept");
    const reason = error instanceof Error ? error.message : String(error);

    onProgress?.(
      "Advanced compression could not be applied; uploading the original PDF.",
    );
    emit({
      ...fallback,
      file: undefined,
      fileName: input.name,
      validationReason: reason,
      message:
        "Advanced compression could not be applied — the original PDF is kept safely.",
    });

    return fallback;
  }
}
