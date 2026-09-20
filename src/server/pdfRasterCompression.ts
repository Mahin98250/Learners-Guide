import sharp from "sharp";
import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";

export type PdfRasterCompressionProfile = "recommended" | "extreme" | "less";

export type PdfRasterCompressionStats = {
  profile: PdfRasterCompressionProfile;
  imagesScanned: number;
  imagesRecompressed: number;
  rasterOriginalBytes: number;
  rasterFinalBytes: number;
  candidateSize: number;
};

export type PdfRasterCompressionResult = {
  bytes: Uint8Array;
  pageCount: number;
  stats: PdfRasterCompressionStats;
};

type ProfileConfig = {
  quality: number;
  maxDimension: number;
  minImageBytes: number;
  maxPixels: number;
};

const PROFILES: Record<PdfRasterCompressionProfile, ProfileConfig> = {
  recommended: {
    quality: 72,
    maxDimension: 2400,
    minImageBytes: 80 * 1024,
    maxPixels: 80_000_000,
  },
  extreme: {
    quality: 55,
    maxDimension: 1700,
    minImageBytes: 48 * 1024,
    maxPixels: 60_000_000,
  },
  less: {
    quality: 82,
    maxDimension: 3200,
    minImageBytes: 96 * 1024,
    maxPixels: 100_000_000,
  },
};

const resolveObject = (pdfDoc: PDFDocument, value: unknown) => {
  if (!value) return undefined;
  return pdfDoc.context.lookup(value as never);
};

const nameText = (value: unknown) => {
  if (!(value instanceof PDFName)) return null;
  return value.toString().replace(/^\\/+/, "");
};

function resolveSingleName(pdfDoc: PDFDocument, value: unknown): string | null {
  return nameText(resolveObject(pdfDoc, value));
}

function resolveFilters(pdfDoc: PDFDocument, value: unknown): string[] {
  const resolved = resolveObject(pdfDoc, value);
  if (!resolved) return [];
  if (resolved instanceof PDFName) return [nameText(resolved) || ""];
  if (resolved instanceof PDFArray) {
    const names: string[] = [];
    for (let index = 0; index < resolved.size(); index += 1) {
      const item = resolved.lookup(index);
      const name = nameText(item);
      if (!name) return [];
      names.push(name);
    }
    return names;
  }
  return [];
}

function resolveColorSpace(pdfDoc: PDFDocument, value: unknown): "DeviceRGB" | "DeviceGray" | null {
  const resolved = resolveObject(pdfDoc, value);
  if (resolved instanceof PDFName) {
    const name = nameText(resolved);
    return name === "DeviceRGB" || name === "DeviceGray" ? name : null;
  }
  if (resolved instanceof PDFArray && resolved.size() > 0) {
    const first = resolved.lookup(0);
    const name = nameText(resolveObject(pdfDoc, first));
    return name === "DeviceRGB" || name === "DeviceGray" ? name : null;
  }
  return null;
}

function hasEntry(dict: PDFDict, key: string) {
  return Boolean(dict.get(PDFName.of(key)));
}

function resizeTarget(width: number, height: number, maxDimension: number) {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function rawImageChannels(colorSpace: "DeviceRGB" | "DeviceGray") {
  return colorSpace === "DeviceRGB" ? 3 : 1;
}

async function encodeAsJpeg(
  source: Buffer,
  sourceKind: "jpeg" | "raw",
  width: number,
  height: number,
  colorSpace: "DeviceRGB" | "DeviceGray",
  profile: ProfileConfig,
) {
  const target = resizeTarget(width, height, profile.maxDimension);
  const sharpInput =
    sourceKind === "jpeg"
      ? sharp(source, {
          limitInputPixels: profile.maxPixels,
          failOn: "warning",
        })
      : sharp(source, {
          raw: {
            width,
            height,
            channels: rawImageChannels(colorSpace),
          },
          limitInputPixels: profile.maxPixels,
          failOn: "warning",
        });

  return sharpInput
    .resize({
      width: target.width,
      height: target.height,
      fit: "fill",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: profile.quality,
      progressive: true,
      chromaSubsampling: "4:2:0",
      mozjpeg: false,
    })
    .toBuffer()
    .then((bytes) => ({ bytes, width: target.width, height: target.height }));
}

async function replaceImageStream(
  pdfDoc: PDFDocument,
  ref: unknown,
  stream: PDFRawStream,
  profile: ProfileConfig,
) {
  const dict = stream.dict;
  if (hasEntry(dict, "ImageMask") || hasEntry(dict, "SMask") || hasEntry(dict, "Mask")) {
    return null;
  }
  if (hasEntry(dict, "Decode") || hasEntry(dict, "DecodeParms")) {
    return null;
  }

  const subtype = resolveSingleName(pdfDoc, dict.get(PDFName.of("Subtype")));
  if (subtype !== "Image") return null;

  const widthObject = dict.get(PDFName.of("Width"));
  const heightObject = dict.get(PDFName.of("Height"));
  const width = widthObject
    ? pdfDoc.context.lookup(widthObject as never, PDFNumber).asNumber()
    : 0;
  const height = heightObject
    ? pdfDoc.context.lookup(heightObject as never, PDFNumber).asNumber()
    : 0;
  const bitsObject = dict.get(PDFName.of("BitsPerComponent"));
  const bits = bitsObject
    ? pdfDoc.context.lookup(bitsObject as never, PDFNumber).asNumber()
    : 0;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    bits !== 8 ||
    width * height > profile.maxPixels
  ) {
    return null;
  }

  const colorSpace = resolveColorSpace(pdfDoc, dict.get(PDFName.of("ColorSpace")));
  if (!colorSpace) return null;

  const filters = resolveFilters(pdfDoc, dict.get(PDFName.of("Filter")));
  if (filters.length !== 1) return null;

  let sourceKind: "jpeg" | "raw";
  let sourceBytes: Uint8Array;

  if (filters[0] === "DCTDecode") {
    sourceKind = "jpeg";
    sourceBytes = stream.contents;
  } else if (filters[0] === "FlateDecode") {
    sourceKind = "raw";
    sourceBytes = decodePDFRawStream(stream).decode();
    const expected = width * height * rawImageChannels(colorSpace);
    if (sourceBytes.byteLength !== expected) return null;
  } else {
    return null;
  }

  if (sourceBytes.byteLength < profile.minImageBytes) return null;

  const encoded = await encodeAsJpeg(
    Buffer.from(sourceBytes),
    sourceKind,
    width,
    height,
    colorSpace,
    profile,
  );

  if (
    !encoded.bytes.length ||
    encoded.bytes.byteLength >= sourceBytes.byteLength
  ) {
    return null;
  }

  const nextDict = dict.clone(pdfDoc.context);
  nextDict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
  nextDict.set(PDFName.of("Width"), PDFNumber.of(encoded.width));
  nextDict.set(PDFName.of("Height"), PDFNumber.of(encoded.height));
  nextDict.set(PDFName.of("Length"), PDFNumber.of(encoded.bytes.byteLength));
  nextDict.delete(PDFName.of("DecodeParms"));

  const nextStream = PDFRawStream.of(nextDict, new Uint8Array(encoded.bytes));
  pdfDoc.context.assign(ref as never, nextStream);

  return {
    originalBytes: sourceBytes.byteLength,
    finalBytes: encoded.bytes.byteLength,
  };
}

export async function compressPdfRaster(
  input: Uint8Array,
  profileName: PdfRasterCompressionProfile,
): Promise<PdfRasterCompressionResult> {
  const profile = PROFILES[profileName];
  if (!profile) throw new Error("Unknown PDF raster compression profile.");

  const pdfDoc = await PDFDocument.load(input, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });

  const pageCount = pdfDoc.getPageCount();
  if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
    throw new Error("PDF has an invalid page count.");
  }

  let imagesScanned = 0;
  let imagesRecompressed = 0;
  let rasterOriginalBytes = 0;
  let rasterFinalBytes = 0;

  for (const [ref, object] of pdfDoc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;

    const subtype = resolveSingleName(pdfDoc, object.dict.get(PDFName.of("Subtype")));
    if (subtype !== "Image") continue;

    imagesScanned += 1;

    try {
      const result = await replaceImageStream(pdfDoc, ref, object, profile);
      if (!result) continue;
      imagesRecompressed += 1;
      rasterOriginalBytes += result.originalBytes;
      rasterFinalBytes += result.finalBytes;
    } catch (error) {
      console.warn("Skipping an image that could not be safely recompressed.", error);
    }
  }

  const candidate = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
    objectsPerTick: 25,
  });

  if (!(candidate instanceof Uint8Array) || candidate.byteLength === 0) {
    throw new Error("Raster compression produced an empty PDF.");
  }

  return {
    bytes: candidate,
    pageCount,
    stats: {
      profile: profileName,
      imagesScanned,
      imagesRecompressed,
      rasterOriginalBytes,
      rasterFinalBytes,
      candidateSize: candidate.byteLength,
    },
  };
}
