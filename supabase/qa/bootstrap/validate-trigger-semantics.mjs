#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SQL = path.join(ROOT, "supabase", "qa", "bootstrap", "production-derived-bootstrap.sql");
const DEFINITIONS = path.join(ROOT, "supabase", "qa", "bootstrap", "production-trigger-definitions.json");
const fail = (message) => { throw new Error(`[QA trigger semantics] ${message}`); };

const sql = fs.readFileSync(SQL, "utf8");
const artifact = JSON.parse(fs.readFileSync(DEFINITIONS, "utf8"));
const expected = new Map(artifact.triggers.map((trigger) => [
  `${trigger.schema}.${trigger.table}.${trigger.name}`,
  `${trigger.definition.trim()};`,
]));
if (expected.size !== 31) fail(`Expected 31 unique trigger definitions, found ${expected.size}`);

const actual = new Map();
for (const line of sql.split("\n")) {
  const match = line.match(/^CREATE TRIGGER (.+?) (BEFORE|AFTER|INSTEAD OF) (.+?) ON (?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z_][A-Za-z0-9_]*) /i);
  if (!match) continue;
  const schema = match[4] ?? "public";
  const table = match[5];
  const name = match[1].replace(/^"|"$/g, "");
  const key = `${schema}.${table}.${name}`;
  actual.set(key, line.trim());
}
if (actual.size !== expected.size) fail(`Expected ${expected.size} trigger statements, found ${actual.size}`);
for (const [key, definition] of expected) {
  const actualDefinition = actual.get(key);
  if (!actualDefinition) fail(`Missing trigger: ${key}`);
  const normalize = (value) => value.replaceAll('"', "").replace(/\s+/g, " ").trim().toLowerCase();
  if (normalize(actualDefinition) !== normalize(definition)) {
    fail(`Trigger semantics mismatch for ${key}\nExpected: ${definition}\nActual: ${actualDefinition}`);
  }
}

const semanticTokens = ["UPDATE OF", "WHEN (new.batch_id IS NOT NULL)"];
for (const token of semanticTokens) {
  if (!sql.includes(token)) fail(`Repaired bootstrap is missing required semantic token: ${token}`);
}
console.log(`[QA trigger semantics] PASS — ${expected.size} exact trigger definitions verified`);
