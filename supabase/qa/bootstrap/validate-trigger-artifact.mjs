#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, "supabase", "schema-baseline", "production-derived-schema-baseline.json");
const DEFINITIONS = path.join(ROOT, "supabase", "qa", "bootstrap", "production-trigger-definitions.json");
const fail = (message) => { throw new Error(`[QA trigger artifact] ${message}`); };

const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const artifact = JSON.parse(fs.readFileSync(DEFINITIONS, "utf8"));
if (baseline.source_project_ref !== artifact.source_project_ref) fail("Baseline and trigger artifact reference different Supabase projects");
if (!Array.isArray(baseline.triggers)) fail("Baseline triggers are missing");
if (!Array.isArray(artifact.triggers) || artifact.triggers.length !== 31) fail("Trigger artifact must contain 31 actual PostgreSQL triggers");

const baselineKeys = new Set(baseline.triggers.map((trigger) => `${trigger.schema}.${trigger.table}.${trigger.name}`));
const artifactKeys = new Set();
for (const trigger of artifact.triggers) {
  const key = `${trigger.schema}.${trigger.table}.${trigger.name}`;
  if (artifactKeys.has(key)) fail(`Duplicate trigger artifact entry: ${key}`);
  artifactKeys.add(key);
  if (!baselineKeys.has(key)) fail(`Trigger artifact is not present in production schema baseline: ${key}`);
}

if (baselineKeys.size !== artifactKeys.size || [...baselineKeys].some((key) => !artifactKeys.has(key))) {
  fail(`Trigger key mismatch: baseline unique keys=${baselineKeys.size}, artifact keys=${artifactKeys.size}`);
}

console.log(`[QA trigger artifact] PASS — ${artifactKeys.size} actual triggers represented; baseline contains ${baseline.triggers.length} event rows`);
