#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, "supabase", "schema-baseline", "production-derived-schema-baseline.json");
const OUT = path.join(ROOT, "supabase", "qa", "bootstrap", "production-derived-bootstrap.sql");

const fail = (message) => {
  throw new Error("[QA bootstrap] " + message);
};

const escIdent = (value) => {
  if (typeof value !== "string" || !value) fail("Invalid identifier");
  return '"' + value.replaceAll('"', '""') + '"';
};

const escLit = (value) => "'" + String(value).replaceAll("'", "''") + "'";

const qualified = (schema, name) => `${escIdent(schema)}.${escIdent(name)}`;

const PG_ARRAY_UDT_TO_TYPE = new Map([
  ["_bool", "boolean"],
  ["_bytea", "bytea"],
  ["_date", "date"],
  ["_float4", "real"],
  ["_float8", "double precision"],
  ["_int2", "smallint"],
  ["_int4", "integer"],
  ["_int8", "bigint"],
  ["_json", "json"],
  ["_jsonb", "jsonb"],
  ["_numeric", "numeric"],
  ["_text", "text"],
  ["_time", "time"],
  ["_timetz", "time with time zone"],
  ["_timestamp", "timestamp without time zone"],
  ["_timestamptz", "timestamp with time zone"],
  ["_uuid", "uuid"],
]);

const renderPostgresType = (column) => {
  if (typeof column?.type !== "string" || !column.type) {
    fail(`Missing PostgreSQL type for ${column?.schema ?? "?"}.${column?.table ?? "?"}.${column?.column ?? "?"}`);
  }

  if (column.type.toUpperCase() !== "ARRAY") {
    return column.type;
  }

  if (typeof column.udt !== "string" || !column.udt.startsWith("_")) {
    fail(`Array column ${column.schema ?? "?"}.${column.table ?? "?"}.${column.column ?? "?"} lacks a usable PostgreSQL array UDT.`);
  }

  const elementType = PG_ARRAY_UDT_TO_TYPE.get(column.udt);
  if (!elementType) {
    fail(`Unsupported PostgreSQL array UDT "${column.udt}" for ${column.schema ?? "?"}.${column.table ?? "?"}.${column.column ?? "?"}; refusing to guess.`);
  }

  return `${elementType}[]`;
};

const sortBy = (items, ...keys) =>
  [...(items ?? [])].sort((a, b) => {
    for (const key of keys) {
      const av = String(a?.[key] ?? "");
      const bv = String(b?.[key] ?? "");
      const cmp = av.localeCompare(bv);
      if (cmp) return cmp;
    }
    return 0;
  });

const assertArray = (obj, key) => {
  if (!Array.isArray(obj?.[key])) fail(`Baseline property "${key}" must be an array`);
  return obj[key];
};

const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));

if (baseline.artifact_type !== "PRODUCTION-DERIVED SCHEMA BASELINE") {
  fail("Unexpected baseline artifact_type");
}
if (baseline.data_policy && /production application rows|auth\.users rows.*included/i.test(baseline.data_policy)) {
  fail("Baseline data policy is unsafe.");
}
if (baseline.source_project_ref === "efnxjfzyqbdulpjhffsm") {
  // The source ref documents where the snapshot came from. It is never used as a connection target.
}
for (const key of [
  "catalog_tables","columns","constraints","indexes","functions","triggers","policies",
  "extensions","table_grants","routine_grants","storage_buckets","storage_policies","types","views"
]) assertArray(baseline, key);

// The production export flattens managed Supabase qualified relations under
// schema="public", storing the full qualified relation name in the table field.
// Example: { schema: "public", table: "storage.objects" }.
const MANAGED_EXTERNAL_RELATIONS = new Set([
  "auth.users",
  "storage.objects",
]);

const normalizeRelation = (schema, name) => {
  const qualifiedName = `${schema}.${name}`;
  if (schema === "public" && MANAGED_EXTERNAL_RELATIONS.has(name)) return name;
  if (MANAGED_EXTERNAL_RELATIONS.has(qualifiedName)) return qualifiedName;
  return qualifiedName;
};

const isManagedExternalRelation = (schema, name) =>
  MANAGED_EXTERNAL_RELATIONS.has(normalizeRelation(schema, name));

const tables = sortBy(
  baseline.catalog_tables.filter((t) => !isManagedExternalRelation(t.schema, t.name)),
  "schema", "name"
);

const publicColumns = baseline.columns.filter(
  (c) => c.schema === "public" && !isManagedExternalRelation(c.schema, c.table)
);
const columnsByTable = new Map();
for (const c of sortBy(publicColumns, "table", "ordinal", "column")) {
  if (!columnsByTable.has(c.table)) columnsByTable.set(c.table, []);
  columnsByTable.get(c.table).push(c);
}
const tableNames = new Set(tables.filter((t) => t.schema === "public").map((t) => t.name));
const managedRelationNames = new Set(MANAGED_EXTERNAL_RELATIONS);

const publicTypes = sortBy(
  baseline.types.filter((t) => t.schema === "public" && (t.kind === "e" || t.kind === "d")),
  "schema", "name"
);
const generatedRowTypes = baseline.types.filter((t) => t.schema === "public" && t.kind === "c");

for (const c of publicColumns) {
  if (!tableNames.has(c.table) && !isManagedExternalRelation(c.schema, c.table)) {
    fail(`Column references missing application table ${c.schema}.${c.table}`);
  }
  if (!c.type) fail(`Missing type for public.${c.table}.${c.column}`);
}

for (const constraint of baseline.constraints) {
  if (constraint.schema !== "public") continue;
  if (!tableNames.has(constraint.table) && !isManagedExternalRelation("public", constraint.table)) {
    fail(`Constraint references missing application table public.${constraint.table}`);
  }
}

const statements = [];
const push = (sql, comment = "") => {
  if (comment) statements.push(comment.trimEnd());
  statements.push(sql.trimEnd() + "\n");
};

push("-- Generated from the current production-derived structural baseline.", "--");
push("-- THIS IS QA BOOTSTRAP ONLY. DO NOT RUN AGAINST PRODUCTION.", "--");
push("-- It intentionally excludes production rows, auth.users, storage object bytes, and historical migration backfills.", "--");
push(`-- Baseline generated on ${baseline.generated_on ?? "unknown date"} from project ref ${baseline.source_project_ref ?? "unknown"}.`, "--");
push("set lock_timeout = '30s';\nset statement_timeout = '120s';");

for (const ext of sortBy(baseline.extensions, "schema", "name")) {
  if (ext.name === "plpgsql") continue;
  if (!/^(btree_gist|pgcrypto|uuid-ossp|pg_net|pg_stat_statements|supabase_vault)$/i.test(ext.name)) continue;
  push(`create extension if not exists ${escIdent(ext.name)};`);
}

for (const type of publicTypes) {
  if (type.kind === "e") {
    const values = Array.isArray(type.enum_values) ? type.enum_values : [];
    if (!values.length) fail(`Enum public.${type.name} has no enum values`);
    push(`do $$ begin if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname=${escLit(type.name)}) then create type ${qualified(type.schema, type.name)} as enum (${values.map(escLit).join(", ")}); end if; end $$;`);
  } else if (type.kind === "d") {
    fail(`Domain type public.${type.name} requires explicit domain DDL; refusing to invent it.`);
  }
}
// kind=c entries are PostgreSQL table-composite row types generated automatically.
// They MUST NOT be emitted as CREATE TYPE statements.

for (const table of tables.filter((t) => t.schema === "public")) {
  const cols = columnsByTable.get(table.name);
  if (!cols?.length) fail(`No columns captured for public.${table.name}`);
  const defs = cols.map((c) => {
    let d = `${escIdent(c.column)} ${renderPostgresType(c)}`;
    if (c.identity === "a") d += " generated always as identity";
    else if (c.identity === "d") d += " generated by default as identity";
    if (c.generated === "s") {
      const match = String(c.default ?? "").match(/^GENERATED\s+ALWAYS\s+AS\s*\((.*)\)\s+STORED$/is);
      if (!match) fail(`Generated column public.${table.name}.${c.column} lacks reproducible generation expression`);
      d = `${escIdent(c.column)} ${renderPostgresType(c)} generated always as (${match[1]}) stored`;
    }
    if (c.not_null) d += " not null";
    return d;
  });
  push(`create table ${qualified(table.schema, table.name)} (\n  ${defs.join(",\n  ")}\n);`);
}

const generatedPkUniqueNames = new Set();
const normalViews = baseline.views.filter((v) =>
  v.schema === "public" &&
  v.name !== "storage.objects" &&
  !/\bstorage\.objects\b/i.test(String(v.definition ?? ""))
);
for (const view of sortBy(normalViews, "schema", "name")) {
  if (!view.definition) fail(`View public.${view.name} lacks definition`);
  push(`create or replace view ${qualified(view.schema, view.name)} as\n${view.definition};`);
}

const functionCandidates = sortBy(baseline.functions, "schema", "name", "args");

// SQL-language functions may be parsed against their referenced functions at CREATE
// FUNCTION time. Build a dependency graph from exact known public function names.
// The previous implementation used /\\b/ in a RegExp literal, which searched for a
// literal backslash+b and therefore missed references such as public.app_role().
const functionDependencies = new Map();
const functionKeysByName = new Map();
for (const fn of functionCandidates) {
  const key = `${fn.schema}.${fn.name}(${fn.args ?? ""})`;
  if (!functionKeysByName.has(`${fn.schema}.${fn.name}`)) functionKeysByName.set(`${fn.schema}.${fn.name}`, []);
  functionKeysByName.get(`${fn.schema}.${fn.name}`).push(key);
}

for (const fn of functionCandidates) {
  const key = `${fn.schema}.${fn.name}(${fn.args ?? ""})`;
  const deps = new Set();
  if (fn.schema === "public" && fn.language === "sql") {
    const body = String(fn.definition ?? "");
    const callPattern = /\b(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    for (const match of body.matchAll(callPattern)) {
      const dependencyName = match[1];
      if (dependencyName === fn.name) continue;
      const dependencyKeys = functionKeysByName.get(`public.${dependencyName}`) ?? [];
      for (const dependencyKey of dependencyKeys) deps.add(dependencyKey);
    }
  }
  functionDependencies.set(key, deps);
}

const functionsByKey = new Map(
  functionCandidates.map((fn) => [`${fn.schema}.${fn.name}(${fn.args ?? ""})`, fn])
);

const indegree = new Map([...functionsByKey.keys()].map((key) => [key, 0]));
const dependents = new Map([...functionsByKey.keys()].map((key) => [key, new Set()]));
for (const [fnKey, deps] of functionDependencies) {
  for (const depKey of deps) {
    if (!functionsByKey.has(depKey)) continue;
    indegree.set(fnKey, indegree.get(fnKey) + 1);
    dependents.get(depKey).add(fnKey);
  }
}

const ready = [...indegree.entries()]
  .filter(([, degree]) => degree === 0)
  .map(([key]) => key)
  .sort();

const functionCreationOrder = [];
while (ready.length) {
  const key = ready.shift();
  functionCreationOrder.push(key);
  for (const dependent of [...dependents.get(key)].sort()) {
    const nextDegree = indegree.get(dependent) - 1;
    indegree.set(dependent, nextDegree);
    if (nextDegree === 0) {
      ready.push(dependent);
      ready.sort();
    }
  }
}

if (functionCreationOrder.length !== functionsByKey.size) {
  const cycle = [...indegree.entries()]
    .filter(([, degree]) => degree > 0)
    .map(([key]) => key)
    .sort();
  fail(`Function dependency cycle detected: ${cycle.join(", ")}`);
}

const functionList = functionCreationOrder.map((key) => functionsByKey.get(key));
for (const fn of functionList) {
  if (fn.schema !== "public") continue;
  if (!fn.definition) fail(`Function public.${fn.name}(${fn.args ?? ""}) has no definition`);
  const functionDdl = fn.definition.trimEnd().endsWith(";")
    ? fn.definition.trimEnd()
    : fn.definition.trimEnd() + ";";
  push(functionDdl + "\n");
}

for (const trigger of sortBy(baseline.triggers, "schema", "table", "name", "event")) {
  if (trigger.schema !== "public") continue;
  if (!trigger.definition) fail(`Trigger public.${trigger.table}.${trigger.name} lacks definition`);
  push(`drop trigger if exists ${escIdent(trigger.name)} on ${qualified(trigger.schema, trigger.table)};`);
  const eventSql = trigger.event;
  const timingSql = trigger.timing;
  const orientation = trigger.orientation || "ROW";
  push(`create trigger ${escIdent(trigger.name)} ${timingSql} ${eventSql} on ${qualified(trigger.schema, trigger.table)} for each ${orientation.toLowerCase()} ${trigger.definition};`);
}

for (const constraint of sortBy(baseline.constraints, "schema", "table", "name")) {
  if (constraint.schema !== "public") continue;
  push(`alter table ${qualified(constraint.schema, constraint.table)} add constraint ${escIdent(constraint.name)} ${constraint.definition};`);
}

for (const col of sortBy(publicColumns, "table", "ordinal", "column")) {
  if (col.default) {
    push(`alter table ${qualified("public", col.table)} alter column ${escIdent(col.column)} set default ${col.default};`);
  }
}

for (const idx of sortBy(baseline.indexes, "schema", "table", "name")) {
  if (idx.schema !== "public") continue;
  if (!idx.definition) fail(`Index public.${idx.name} lacks definition`);
  const ddl = String(idx.definition)
    .replace(/\bcreate\s+unique\s+index\b/i, "create unique index if not exists")
    .replace(/\bcreate\s+index\b/i, "create index if not exists");
  push(ddl + ";");
}

for (const table of tables.filter((t) => t.schema === "public" && t.rls)) {
  push(`alter table ${qualified(table.schema, table.name)} enable row level security;`);
}

for (const policy of sortBy(baseline.policies, "schema", "table", "name")) {
  if (policy.schema !== "public") continue;
  if (!policy.cmd) fail(`Policy public.${policy.table}.${policy.name} lacks command`);
  const roles = Array.isArray(policy.roles) ? policy.roles.map(escIdent).join(", ") : "public";
  let sql = `create policy ${escIdent(policy.name)} on ${qualified(policy.schema, policy.table)} as ${policy.permissive === "RESTRICTIVE" ? "restrictive" : "permissive"} for ${policy.cmd.toLowerCase()} to ${roles}`;
  if (policy.using_expression) sql += ` using (${policy.using_expression})`;
  if (policy.with_check) sql += ` with check (${policy.with_check})`;
  push(sql + ";");
}

for (const grant of sortBy(baseline.table_grants, "schema", "table", "grantee", "privilege")) {
  if (grant.schema !== "public") continue;
  push(`grant ${grant.privilege} on table ${qualified(grant.schema, grant.table)} to ${escIdent(grant.grantee)};`);
}

const functionsByName = new Map();
for (const fn of functionList) {
  const key = `${fn.schema}.${fn.name}`;
  if (!functionsByName.has(key)) functionsByName.set(key, []);
  functionsByName.get(key).push(fn);
}
for (const grant of sortBy(baseline.routine_grants, "schema", "routine", "grantee", "privilege")) {
  if (grant.schema !== "public") continue;
  const matches = functionsByName.get(`${grant.schema}.${grant.routine}`) ?? [];
  if (!matches.length) fail(`Routine grant references missing function ${grant.schema}.${grant.routine}`);
  for (const fn of matches) {
    push(`grant ${grant.privilege} on function ${qualified(fn.schema, fn.name)}(${fn.args ?? ""}) to ${escIdent(grant.grantee)};`);
  }
}

push("-- Managed Supabase relations are externally supplied and are never recreated.");
push(`-- Explicit managed relations allowlisted: ${[...managedRelationNames].sort().join(", ")}.`);
push("-- Storage configuration is intentionally limited to buckets/policies; storage.objects itself is Supabase-managed.");
for (const bucket of sortBy(baseline.storage_buckets, "id")) {
  const mime = Array.isArray(bucket.allowed_mime_types)
    ? `array[${bucket.allowed_mime_types.map(escLit).join(", ")}]`
    : "null";
  const size = bucket.file_size_limit == null ? "null" : String(bucket.file_size_limit);
  push(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (${escLit(bucket.id)}, ${escLit(bucket.name)}, ${Boolean(bucket.public)}, ${size}, ${mime}) on conflict (id) do update set name=excluded.name, public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;`);
}
for (const policy of sortBy(baseline.storage_policies, "schema", "table", "name")) {
  if (policy.schema !== "storage") continue;
  const roles = Array.isArray(policy.roles) ? policy.roles.map(escIdent).join(", ") : "public";
  let sql = `create policy ${escIdent(policy.name)} on storage.objects as ${policy.permissive === "RESTRICTIVE" ? "restrictive" : "permissive"} for ${policy.cmd.toLowerCase()} to ${roles}`;
  if (policy.using_expression) sql += ` using (${policy.using_expression})`;
  if (policy.with_check) sql += ` with check (${policy.with_check})`;
  push(sql + ";");
}

push("-- Baseline sanity notes:");
push(`-- Generated PostgreSQL row types excluded: ${generatedRowTypes.length}.`);
push("-- Historical production data/backfills are not replayed.");
push("-- Managed auth.users and the managed storage.objects relation are provided by local Supabase.");
push("-- This file must never be pointed at the hosted production project.");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, statements.join("\n") + "\n", "utf8");
console.log(`[QA bootstrap] wrote ${OUT}`);
