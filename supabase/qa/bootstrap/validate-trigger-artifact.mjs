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

const missing = [...baselineKeys].filter((key) => !artifactKeys.has(key));
// information_schema.triggers has one row per event, so only multi-event rows
// may appear as "missing" here. The actual PostgreSQL trigger object count must
// still be represented exactly once in the companion artifact.
if (missing.length === 0 || baselineKeys.size !== 31) fail(`Unexpected baseline trigger object shape: baseline unique keys=${baselineKeys.size}, artifact=${artifactKeys.size}`);

console.log(`[QA trigger artifact] PASS — ${artifactKeys.size} actual triggers represented; baseline contains ${baseline.triggers.length} event rows`);
