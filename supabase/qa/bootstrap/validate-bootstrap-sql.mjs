#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SQL_PATH = path.join(ROOT, "supabase", "qa", "bootstrap", "production-derived-bootstrap.sql");
const fail = (message) => { throw new Error(`[QA bootstrap SQL] ${message}`); };

const sql = fs.readFileSync(SQL_PATH, "utf8");
const normalized = sql.toLowerCase();

if (!sql.trim()) fail("Generated bootstrap SQL is empty.");
if (!/qa bootstrap only/i.test(sql)) fail("QA-only safety marker is missing.");
if (/\b(?:insert\s+into|copy)\s+(?:public\.)/i.test(sql)) fail("Application data statements are present.");
if (/\bcreate\s+(?:table|view)\s+(?:auth\.users|storage\.objects)/i.test(sql)) fail("Managed Supabase relations must not be recreated.");
if (/\b(?:encrypted_password|refresh_token|service_role_key|access_token)\b/i.test(sql)) fail("Credential/token-like field content is present.");

const tableCount = (normalized.match(/\bcreate\s+table\s+"?public"?\./g) ?? []).length;
if (tableCount !== 27) fail(`Expected exactly 27 public application tables, found ${tableCount}.`);

const functionMatches = [...sql.matchAll(/\bcreate\s+or\s+replace\s+function\s+public\.([\w"]+)\s*\(/gi)];
if (functionMatches.length !== 55) fail(`Expected 55 public functions from the structural baseline, found ${functionMatches.length}.`);

const appRoleIndex = normalized.indexOf("create or replace function public.app_role()");
if (appRoleIndex < 0) fail("public.app_role() definition is missing.");
const firstFunctionIndex = normalized.indexOf("create or replace function");
if (firstFunctionIndex !== appRoleIndex) fail("public.app_role() must be the first emitted function because RLS/security helpers depend on it.");

const policyIndex = normalized.indexOf("create policy");
if (policyIndex >= 0 && appRoleIndex > policyIndex) fail("RLS policies are emitted before public.app_role().");

for (let index = 0; index < functionMatches.length; index += 1) {
  const start = functionMatches[index].index;
  const end = index + 1 < functionMatches.length ? functionMatches[index + 1].index : sql.length;
  const block = sql.slice(start, end).trimEnd();
  if (!/\$function\$;\s*$/i.test(block)) {
    fail(`Function block ${index + 1} does not terminate with $function$; before the next statement.`);
  }
}

console.log(`[QA bootstrap SQL] PASS — ${tableCount} tables, ${functionMatches.length} functions, app_role-first ordering, and safety boundaries verified.`);
