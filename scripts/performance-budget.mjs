import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const PERFORMANCE_BUDGET = Object.freeze({
  htmlBytes: 4 * 1024,
  manifestBytes: 1 * 1024,
  maxJsChunkBytes: 700 * 1024,
  maxJsTotalGzipBytes: 2 * 1024 * 1024,
  maxCssTotalGzipBytes: 350 * 1024,
  maxDataUriBytesInHtml: 4 * 1024,
});

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

function packedSizes(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer).length,
  };
}

async function readIfPresent(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function auditBuild(distDir = "dist") {
  const absoluteDist = path.resolve(distDir);
  const files = await walkFiles(absoluteDist);
  const js = [];
  const css = [];

  for (const filePath of files) {
    const relative = path.relative(absoluteDist, filePath).replaceAll(path.sep, "/");
    const buffer = await fs.readFile(filePath);
    const record = { path: relative, ...packedSizes(buffer) };
    if (relative.endsWith(".js") || relative.endsWith(".mjs")) js.push(record);
    if (relative.endsWith(".css")) css.push(record);
  }

  js.sort((a, b) => b.raw - a.raw);
  css.sort((a, b) => b.raw - a.raw);

  const html = await readIfPresent(path.join(absoluteDist, "index.html"));
  const manifest = await readIfPresent(path.join(absoluteDist, "manifest.webmanifest"));

  const findings = [];
  if (!html) {
    findings.push("dist/index.html is missing");
  } else {
    const htmlText = html.toString("utf8");
    const dataUris = [...htmlText.matchAll(/data:[^"'\s>]+/gi)].reduce((total, match) => total + match[0].length, 0);
    if (html.length > PERFORMANCE_BUDGET.htmlBytes) {
      findings.push(`index.html is ${formatBytes(html.length)}; budget is ${formatBytes(PERFORMANCE_BUDGET.htmlBytes)}`);
    }
    if (dataUris > PERFORMANCE_BUDGET.maxDataUriBytesInHtml) {
      findings.push(`index.html contains ${formatBytes(dataUris)} of data: URI payload; budget is ${formatBytes(PERFORMANCE_BUDGET.maxDataUriBytesInHtml)}`);
    }
  }

  if (!manifest) {
    findings.push("dist/manifest.webmanifest is missing");
  } else if (manifest.length > PERFORMANCE_BUDGET.manifestBytes) {
    findings.push(`manifest.webmanifest is ${formatBytes(manifest.length)}; budget is ${formatBytes(PERFORMANCE_BUDGET.manifestBytes)}`);
  }

  const largestJs = js[0]?.raw ?? 0;
  const totalJsGzip = js.reduce((sum, item) => sum + item.gzip, 0);
  const totalCssGzip = css.reduce((sum, item) => sum + item.gzip, 0);

  if (largestJs > PERFORMANCE_BUDGET.maxJsChunkBytes) {
    findings.push(`largest JS chunk is ${formatBytes(largestJs)}; budget is ${formatBytes(PERFORMANCE_BUDGET.maxJsChunkBytes)}`);
  }
  if (totalJsGzip > PERFORMANCE_BUDGET.maxJsTotalGzipBytes) {
    findings.push(`total JS gzip size is ${formatBytes(totalJsGzip)}; budget is ${formatBytes(PERFORMANCE_BUDGET.maxJsTotalGzipBytes)}`);
  }
  if (totalCssGzip > PERFORMANCE_BUDGET.maxCssTotalGzipBytes) {
    findings.push(`total CSS gzip size is ${formatBytes(totalCssGzip)}; budget is ${formatBytes(PERFORMANCE_BUDGET.maxCssTotalGzipBytes)}`);
  }

  const result = {
    htmlBytes: html?.length ?? null,
    manifestBytes: manifest?.length ?? null,
    jsCount: js.length,
    cssCount: css.length,
    largestJs,
    totalJsGzip,
    totalCssGzip,
    topJs: js.slice(0, 10),
    topCss: css.slice(0, 5),
    findings,
    ok: findings.length === 0,
  };

  return result;
}

const thisFile = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] || "") === thisFile) {
  const result = await auditBuild(process.argv[2] || "dist");
  console.log("=== Mahin production performance budget ===");
  console.log(`HTML: ${result.htmlBytes == null ? "missing" : formatBytes(result.htmlBytes)}`);
  console.log(`Manifest: ${result.manifestBytes == null ? "missing" : formatBytes(result.manifestBytes)}`);
  console.log(`JS chunks: ${result.jsCount}; total gzip: ${formatBytes(result.totalJsGzip)}`);
  console.log(`CSS files: ${result.cssCount}; total gzip: ${formatBytes(result.totalCssGzip)}`);
  if (result.topJs.length) {
    console.log("Largest JS chunks:");
    for (const item of result.topJs) {
      console.log(`  ${item.path}: raw ${formatBytes(item.raw)}, gzip ${formatBytes(item.gzip)}, brotli ${formatBytes(item.brotli)}`);
    }
  }
  if (!result.ok) {
    console.error("Performance budget failed:");
    for (const finding of result.findings) console.error(`  - ${finding}`);
    process.exitCode = 1;
  } else {
    console.log("Performance budget passed.");
  }
}
