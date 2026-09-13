#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SQL = path.join(ROOT, "supabase", "qa", "bootstrap", "production-derived-bootstrap.sql");
const DEFINITIONS = path.join(ROOT, "supabase", "qa", "bootstrap", "production-trigger-definitions.json");

const fail = (message) => { throw new Error(`[QA trigger semantics] ${message}`); };
const bootstrap = fs.readFileSync(SQL, "utf8");
const artifact = JSON.parse(fs.readFileSync(DEFINITIONS, "utf8"));
if (artifact.artifact_type !== "PRODUCTION-DERIVED TRIGGER DEFINITIONS") fail("Unexpected trigger definition artifact type");
if (!Array.isArray(artifact.triggers) || artifact.triggers.length !== 31) fail("Expected exactly 31 production trigger definitions");

const definitions = [...artifact.triggers].sort((a, b) => `${a.schema}.${a.table}.${a.name}`.localeCompare(`${b.schema}.${b.table}.${b.name}`));
const keys = new Set();
for (const trigger of definitions) {
  for (const key of ["schema", "table", "name", "definition"]) {
    if (typeof trigger[key] !== "string" || !trigger[key]) fail(`Trigger metadata is incomplete for ${JSON.stringify(trigger)}`);
  }
  const key = `${trigger.schema}.${trigger.table}.${trigger.name}`;
  if (keys.has(key)) fail(`Duplicate trigger definition: ${key}`);
  keys.add(key);
  if (!/^CREATE TRIGGER /i.test(trigger.definition)) fail(`Not a complete CREATE TRIGGER definition: ${key}`);
}

// The generic information_schema reconstruction intentionally loses UPDATE OF
// and WHEN clauses. Remove its trigger statements and replace them with the
// exact pg_get_triggerdef-derived structural definitions captured above.
const lines = bootstrap.split("\n");
const withoutGeneratedTriggers = lines.filter((line) =>
  !/^\s*(?:drop\s+trigger\s+if\s+exists|create\s+trigger)\b/i.test(line),
);
const repaired = `${withoutGeneratedTriggers.join("\n").replace(/\n+$/, "")}\n\n-- Exact production trigger definitions (including UPDATE OF and WHEN semantics).\n${definitions.map((trigger) => `${trigger.definition};`).join("\n")}\n`;

fs.writeFileSync(SQL, repaired, "utf8");
console.log(`[QA trigger semantics] restored ${definitions.length} exact trigger definitions`);
