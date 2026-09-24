import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { auditBuild, PERFORMANCE_BUDGET, formatBytes } from "../scripts/performance-budget.mjs";

test("performance budget uses explicit, reviewable guardrails", () => {
  assert.equal(PERFORMANCE_BUDGET.htmlBytes, 4 * 1024);
  assert.equal(PERFORMANCE_BUDGET.manifestBytes, 1024);
  assert.equal(PERFORMANCE_BUDGET.maxJsChunkBytes, 700 * 1024);
  assert.equal(PERFORMANCE_BUDGET.maxJsTotalGzipBytes, 2 * 1024 * 1024);
  assert.equal(PERFORMANCE_BUDGET.maxCssTotalGzipBytes, 350 * 1024);
  assert.match(formatBytes(1024), /1\.0 KiB/);
});

test("performance audit passes a small valid build and reports compressed sizes", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mahin-performance-"));
  try {
    await mkdir(path.join(tempDir, "assets"), { recursive: true });
    await writeFile(
      path.join(tempDir, "index.html"),
      '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    );
    await writeFile(path.join(tempDir, "manifest.webmanifest"), '{"name":"Mahin"}');
    await writeFile(path.join(tempDir, "assets", "app.js"), "console.log('ok');");
    await writeFile(path.join(tempDir, "assets", "app.css"), "body{margin:0}");
    const result = await auditBuild(tempDir);

    assert.equal(result.ok, true);
    assert.equal(result.jsCount, 1);
    assert.equal(result.cssCount, 1);
    assert.ok(result.totalJsGzip > 0);
    assert.ok(result.topJs[0].brotli > 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("performance audit catches oversized critical shell HTML and data URIs", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mahin-performance-"));
  try {
    await writeFile(
      path.join(tempDir, "index.html"),
      `<html><body><img src="data:image/png;base64,${"A".repeat(PERFORMANCE_BUDGET.maxDataUriBytesInHtml + 100)}"></body></html>`,
    );
    await writeFile(path.join(tempDir, "manifest.webmanifest"), "{}");
    const result = await auditBuild(tempDir);
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.includes("index.html")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
