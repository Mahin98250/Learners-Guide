#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, "supabase", "schema-baseline", "production-derived-schema-baseline.json");
const OUT = path.join(ROOT, "supabase", "qa", "bootstrap", "production-derived-bootstrap.sql");

const fail = (message) => { throw new Error("[QA bootstrap] " + message); };
const escIdent = (value) => {
  if (typeof value !== "string" || !value) fail("Invalid identifier");
  return '"' + value.replaceAll('"', '""') + '"';
};
const escLit = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const qualified = (schema, name) => `${escIdent(schema)}.${escIdent(name)}`;

const PG_ARRAY_UDT_TO_TYPE = new Map([
  ["_bool", "boolean"], ["_bytea", "bytea"], ["_date", "date"], ["_float4", "real"],
  ["_float8", "double precision"], ["_int2", "smallint"], ["_int4", "integer"], ["_int8", "bigint"],
  ["_json", "json"], ["_jsonb", "jsonb"], ["_numeric", "numeric"], ["_text", "text"],
  ["_time", "time"], ["_timetz", "time with time zone"], ["_timestamp", "timestamp without time zone"],
  ["_timestamptz", "timestamp with time zone"], ["_uuid", "uuid"],
]);

const renderPostgresType = (column) => {
  if (typeof column?.type !== "string" || !column.type) {
    fail(`Missing PostgreSQL type for ${column?.schema ?? "?"}.${column?.table ?? "?"}.${column?.column ?? "?"}`);
  }
  if (column.type.toUpperCase() !== "ARRAY") return column.type;
  if (typeof column.udt !== "string" || !column.udt.startsWith("_")) {
    fail(`Array column ${column.schema ?? "?"}.${column.table ?? "?"}.${column.column ?? "?"} lacks a usable PostgreSQL array UDT.`);
  }
  const elementType = PG_ARRAY_UDT_TO_TYPE.get(column.udt);
  if (!elementType) {
    fail(`Unsupported PostgreSQL array UDT "${column.udt}" for ${column.schema ?? "?"}.${column.table ?? "?"}.${column.column ?? "?"}; refusing to guess.`);
  }
  return `${elementType}[]`;
};

const sortBy = (items, ...keys) => [...(items ?? [])].sort((a, b) => {
  for (const key of keys) {
    const cmp = String(a?.[key] ?? "").localeCompare(String(b?.[key] ?? ""));
    if (cmp) return cmp;
  }
  return 0;
});
const assertArray = (obj, key) => {
  if (!Array.isArray(obj?.[key])) fail(`Baseline property "${key}" must be an array`);
  return obj[key];
};

const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
if (baseline.artifact_type !== "PRODUCTION-DERIVED SCHEMA BASELINE") fail("Unexpected baseline artifact_type");
if (baseline.data_policy && /production application rows|auth\.users rows.*included/i.test(baseline.data_policy)) {
  fail("Baseline data policy is unsafe.");
}
for (const key of [
  "catalog_tables", "columns", "constraints", "indexes", "functions", "triggers", "policies",
  "extensions", "table_grants", "routine_grants", "storage_buckets", "storage_policies", "types", "views",
]) assertArray(baseline, key);

const MANAGED_EXTERNAL_RELATIONS = new Set(["auth.users", "storage.objects"]);
const normalizeRelation = (schema, name) => {
  const qualifiedName = `${schema}.${name}`;
  if (schema === "public" && MANAGED_EXTERNAL_RELATIONS.has(name)) return name;
  if (MANAGED_EXTERNAL_RELATIONS.has(qualifiedName)) return qualifiedName;
  return qualifiedName;
};
const isManagedExternalRelation = (schema, name) => MANAGED_EXTERNAL_RELATIONS.has(normalizeRelation(schema, name));

const tables = sortBy(
  baseline.catalog_tables.filter((table) => !isManagedExternalRelation(table.schema, table.name)),
  "schema", "name",
);
const publicColumns = baseline.columns.filter(
  (column) => column.schema === "public" && !isManagedExternalRelation(column.schema, column.table),
);
const columnsByTable = new Map();
for (const column of sortBy(publicColumns, "table", "ordinal", "column")) {
  if (!columnsByTable.has(column.table)) columnsByTable.set(column.table, []);
  columnsByTable.get(column.table).push(column);
}
const tableNames = new Set(tables.filter((table) => table.schema === "public").map((table) => table.name));
const publicTypes = sortBy(
  baseline.types.filter((type) => type.schema === "public" && (type.kind === "e" || type.kind === "d")),
  "schema", "name",
);
const generatedRowTypes = baseline.types.filter((type) => type.schema === "public" && type.kind === "c");

for (const column of publicColumns) {
  if (!tableNames.has(column.table) && !isManagedExternalRelation(column.schema, column.table)) {
    fail(`Column references missing application table ${column.schema}.${column.table}`);
  }
  if (!column.type) fail(`Missing type for public.${column.table}.${column.column}`);
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

for (const table of tables.filter((item) => item.schema === "public")) {
  const columns = columnsByTable.get(table.name);
  if (!columns?.length) fail(`No columns captured for public.${table.name}`);
  const definitions = columns.map((column) => {
    let definition = `${escIdent(column.column)} ${renderPostgresType(column)}`;
    if (column.identity === "a") definition += " generated always as identity";
    else if (column.identity === "d") definition += " generated by default as identity";
    if (column.generated === "s") {
      const match = String(column.default ?? "").match(/^GENERATED\s+ALWAYS\s+AS\s*\((.*)\)\s+STORED$/is);
      if (!match) fail(`Generated column public.${table.name}.${column.column} lacks reproducible generation expression`);
      definition = `${escIdent(column.column)} ${renderPostgresType(column)} generated always as (${match[1]}) stored`;
    }
    if (column.not_null) definition += " not null";
    return definition;
  });
  push(`create table ${qualified(table.schema, table.name)} (\n  ${definitions.join(",\n  ")}\n);`);
}

const normalViews = baseline.views.filter((view) =>
  view.schema === "public" && view.name !== "storage.objects" && !/\bstorage\.objects\b/i.test(String(view.definition ?? "")),
);
for (const view of sortBy(normalViews, "schema", "name")) {
  if (!view.definition) fail(`View public.${view.name} lacks definition`);
  push(`create or replace view ${qualified(view.schema, view.name)} as\n${view.definition};`);
}

// Function creation is dependency-aware, but the security identity resolver is a
// bootstrap root: RLS policies depend on app_role(), and app_role() only depends
// on Supabase-managed auth primitives. Emit it first so policy creation can never
// race the helper that every role-aware policy relies upon.
const functionCandidates = sortBy(baseline.functions, "schema", "name", "args");
const functionsByKey = new Map(
  functionCandidates.map((fn) => [`${fn.schema}.${fn.name}(${fn.args ?? ""})`, fn]),
);
const appRoleKey = [...functionsByKey.keys()].find((key) => key === "public.app_role()" || /^public\.app_role\(\s*\)$/.test(key));
if (!appRoleKey) fail("Production baseline is missing required public.app_role(); refusing to generate an RLS bootstrap without the role resolver.");

const functionKeysByName = new Map();
for (const fn of functionCandidates) {
  const nameKey = `${fn.schema}.${fn.name}`;
  if (!functionKeysByName.has(nameKey)) functionKeysByName.set(nameKey, []);
  functionKeysByName.get(nameKey).push(`${fn.schema}.${fn.name}(${fn.args ?? ""})`);
}

const functionDependencies = new Map();
for (const fn of functionCandidates) {
  const key = `${fn.schema}.${fn.name}(${fn.args ?? ""})`;
  const dependencies = new Set();
  if (fn.schema === "public") {
    const body = String(fn.definition ?? "");
    const callPattern = /\b(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    for (const match of body.matchAll(callPattern)) {
      const dependencyName = match[1];
      if (dependencyName === fn.name) continue;
      for (const dependencyKey of functionKeysByName.get(`public.${dependencyName}`) ?? []) {
        dependencies.add(dependencyKey);
      }
    }
  }
  functionDependencies.set(key, dependencies);
}

const indegree = new Map([...functionsByKey.keys()].map((key) => [key, 0]));
const dependents = new Map([...functionsByKey.keys()].map((key) => [key, new Set()]));
for (const [functionKey, dependencies] of functionDependencies) {
  for (const dependencyKey of dependencies) {
    if (!functionsByKey.has(dependencyKey)) continue;
    indegree.set(functionKey, indegree.get(functionKey) + 1);
    dependents.get(dependencyKey).add(functionKey);
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
  const cycle = [...indegree.entries()].filter(([, degree]) => degree > 0).map(([key]) => key).sort();
  fail(`Function dependency cycle detected: ${cycle.join(", ")}`);
}

const emitFunction = (fn) => {
  if (!fn?.definition) fail(`Function public.${fn?.name ?? "?"}(${fn?.args ?? ""}) has no definition`);
  const functionDdl = fn.definition.trimEnd().endsWith(";") ? fn.definition.trimEnd() : `${fn.definition.trimEnd()};`;
  push(functionDdl);
};

// Force the security root before the topological order. Remove it from the normal
// sequence to avoid duplicate CREATE FUNCTION output.
emitFunction(functionsByKey.get(appRoleKey));
for (const key of functionCreationOrder) {
  if (key === appRoleKey) continue;
  const fn = functionsByKey.get(key);
  if (fn.schema !== "public") continue;
  emitFunction(fn);
}

for (const trigger of sortBy(baseline.triggers, "schema", "table", "name", "event")) {
  if (trigger.schema !== "public") continue;
  if (!trigger.definition) fail(`Trigger public.${trigger.table}.${trigger.name} lacks definition`);
  push(`drop trigger if exists ${escIdent(trigger.name)} on ${qualified(trigger.schema, trigger.table)};`);
  push(`create trigger ${escIdent(trigger.name)} ${trigger.timing} ${trigger.event} on ${qualified(trigger.schema, trigger.table)} for each ${(trigger.orientation || "ROW").toLowerCase()} ${trigger.definition};`);
}
for (const constraint of sortBy(baseline.constraints, "schema", "table", "name")) {
  if (constraint.schema !== "public") continue;
  push(`alter table ${qualified(constraint.schema, constraint.table)} add constraint ${escIdent(constraint.name)} ${constraint.definition};`);
}
for (const column of sortBy(publicColumns, "table", "ordinal", "column")) {
  if (column.default) push(`alter table ${qualified("public", column.table)} alter column ${escIdent(column.column)} set default ${column.default};`);
}
for (const index of sortBy(baseline.indexes, "schema", "table", "name")) {
  if (index.schema !== "public") continue;
  if (!index.definition) fail(`Index public.${index.name} lacks definition`);
  const ddl = String(index.definition)
    .replace(/\bcreate\s+unique\s+index\b/i, "create unique index if not exists")
    .replace(/\bcreate\s+index\b/i, "create index if not exists");
  push(ddl.endsWith(";") ? ddl : `${ddl};`);
}
for (const table of tables.filter((item) => item.schema === "public" && item.rls)) {
  push(`alter table ${qualified(table.schema, table.name)} enable row level security;`);
}
for (const policy of sortBy(baseline.policies, "schema", "table", "name")) {
  if (policy.schema !== "public") continue;
  if (!policy.cmd) fail(`Policy public.${policy.table}.${policy.name} lacks command`);
  const roles = Array.isArray(policy.roles) ? policy.roles.map(escIdent).join(", ") : "public";
  let sql = `create policy ${escIdent(policy.name)} on ${qualified(policy.schema, policy.table)} as ${policy.permissive === "RESTRICTIVE" ? "restrictive" : "permissive"} for ${policy.cmd.toLowerCase()} to ${roles}`;
  if (policy.using_expression) sql += ` using (${policy.using_expression})`;
  if (policy.with_check) sql += ` with check (${policy.with_check})`;
  push(`${sql};`);
}
for (const grant of sortBy(baseline.table_grants, "schema", "table", "grantee", "privilege")) {
  if (grant.schema !== "public") continue;
  push(`grant ${grant.privilege} on table ${qualified(grant.schema, grant.table)} to ${escIdent(grant.grantee)};`);
}
const functionsByName = new Map();
for (const fn of functionCandidates) {
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
push(`-- Explicit managed relations allowlisted: ${[...MANAGED_EXTERNAL_RELATIONS].sort().join(", ")}.`);
push("-- Storage configuration is intentionally limited to buckets/policies; storage.objects itself is Supabase-managed.");
for (const bucket of sortBy(baseline.storage_buckets, "id")) {
  const mime = Array.isArray(bucket.allowed_mime_types) ? `array[${bucket.allowed_mime_types.map(escLit).join(", ")}]` : "null";
  const size = bucket.file_size_limit == null ? "null" : String(bucket.file_size_limit);
  push(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (${escLit(bucket.id)}, ${escLit(bucket.name)}, ${Boolean(bucket.public)}, ${size}, ${mime}) on conflict (id) do update set name=excluded.name, public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;`);
}
for (const policy of sortBy(baseline.storage_policies, "schema", "table", "name")) {
  if (policy.schema !== "storage") continue;
  const roles = Array.isArray(policy.roles) ? policy.roles.map(escIdent).join(", ") : "public";
  let sql = `create policy ${escIdent(policy.name)} on storage.objects as ${policy.permissive === "RESTRICTIVE" ? "restrictive" : "permissive"} for ${policy.cmd.toLowerCase()} to ${roles}`;
  if (policy.using_expression) sql += ` using (${policy.using_expression})`;
  if (policy.with_check) sql += ` with check (${policy.with_check})`;
  push(`${sql};`);
}
push("-- Baseline sanity notes:");
push(`-- Generated PostgreSQL row types excluded: ${generatedRowTypes.length}.`);
push("-- Historical production data/backfills are not replayed.");
push("-- Managed auth.users and the managed storage.objects relation are provided by local Supabase.");
push("-- This file must never be pointed at the hosted production project.");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, statements.join("\n") + "\n", "utf8");
console.log(`[QA bootstrap] wrote ${OUT}`);
