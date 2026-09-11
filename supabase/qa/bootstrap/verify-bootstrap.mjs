#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const fail = (m) => { throw new Error("[QA verify] " + m); };
const baselinePath = "supabase/schema-baseline/production-derived-schema-baseline.json";
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
if (baseline.artifact_type !== "PRODUCTION-DERIVED SCHEMA BASELINE") fail("Unexpected baseline artifact type.");
const dbUrl = process.env.LOCAL_DB_URL;
if (!dbUrl) fail("LOCAL_DB_URL is required.");
const u = new URL(dbUrl);
if (!["127.0.0.1","localhost"].includes(u.hostname) || u.port !== "54322") fail("Refusing non-local DB target.");
if (dbUrl.includes("efnxjfzyqbdulpjhffsm")) fail("Production ref detected.");

const q = String.raw`select jsonb_build_object(
'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
'columns',(select jsonb_agg(jsonb_build_object('schema',c.table_schema,'table',c.table_name,'column',c.column_name,'type',c.data_type,'udt',c.udt_name,'nullable',c.is_nullable,'default',c.column_default) order by c.table_name,c.ordinal_position) from information_schema.columns c where c.table_schema='public'),
'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',cl.relname,'name',co.conname,'type',co.contype,'definition',pg_get_constraintdef(co.oid,true)) order by cl.relname,co.conname) from pg_constraint co join pg_class cl on cl.oid=co.conrelid join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public'),
'indexes',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef) order by tablename,indexname) from pg_indexes where schemaname='public'),
'policies',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'cmd',cmd,'using',qual,'check',with_check) order by tablename,policyname) from pg_policies where schemaname='public'),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'language',l.lanname,'security_definer',p.prosecdef,'definition',pg_get_functiondef(p.oid)) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public'),
'triggers',(select jsonb_agg(jsonb_build_object('schema',event_object_schema,'table',event_object_table,'name',trigger_name,'timing',action_timing,'event',event_manipulation,'orientation',action_orientation,'definition',action_statement) order by event_object_table,trigger_name,event_manipulation) from information_schema.triggers where event_object_schema='public'),
'extensions',(select jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',(select nspname from pg_namespace n where n.oid=e.extnamespace)) order by extname) from pg_extension e),
'storage_buckets',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets),
'storage_policies',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'cmd',cmd,'using',qual,'check',with_check) order by policyname) from pg_policies where schemaname='storage' and tablename='objects')
);`;
const p=spawnSync("psql",["--dbname",dbUrl,"--no-psqlrc","-Atqc",q],{encoding:"utf8"});
if(p.status!==0) fail((p.stderr||"psql failed").trim());
const actual=JSON.parse(p.stdout.trim());
const canonical=(x)=>JSON.stringify(x);
const actualData=actual?.jsonb_build_object||actual;
function names(xs,keyFn){return (xs||[]).map(keyFn).sort();}
const expectedTables=names(baseline.catalog_tables.filter(x=>x.schema==="public"),x=>`${x.schema}.${x.name}|${x.rls}`);
const actualTables=names(actualData.tables,x=>`${x.schema}.${x.name}|${x.rls}`);
if(canonical(expectedTables)!==canonical(actualTables)) fail("Table set/RLS state mismatch.");
const expectedCols=names(baseline.columns.filter(x=>x.schema==="public"),x=>`${x.schema}.${x.table}.${x.column}|${x.type}|${x.udt}|${x.nullable}|${x.default??""}`);
const actualCols=names(actualData.columns,x=>`${x.schema}.${x.table}.${x.column}|${x.type}|${x.udt}|${x.nullable}|${x.default??""}`);
if(canonical(expectedCols)!==canonical(actualCols)) fail("Column/type/default/nullability mismatch.");
const expConstraints=names(baseline.constraints.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.type}|${x.definition}`);
const actConstraints=names(actualData.constraints.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.type}|${x.definition}`);
if(canonical(expConstraints)!==canonical(actConstraints)) fail("Constraint mismatch.");
const expIndexes=names(baseline.indexes.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.definition}`);
const actIndexes=names(actualData.indexes.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.definition}`);
if(canonical(expIndexes)!==canonical(actIndexes)) fail("Index mismatch.");
const expTableGrants=names(baseline.table_grants.filter(x=>x.schema==="public"),x=>`${x.table}|${x.grantee}|${x.privilege}`);
const actTableGrants=names(actualData.table_grants.filter(x=>x.schema==="public"),x=>`${x.table}|${x.grantee}|${x.privilege}`);
for(const g of expTableGrants){if(!actTableGrants.includes(g)) fail("Missing table grant: "+g);}
const expRoutineGrants=names(baseline.routine_grants.filter(x=>x.schema==="public"),x=>`${x.routine}|${x.grantee}|${x.privilege}`);
const actRoutineGrants=names(actualData.routine_grants.filter(x=>x.schema==="public"),x=>`${x.routine}|${x.grantee}|${x.privilege}`);
for(const g of expRoutineGrants){if(!actRoutineGrants.includes(g)) fail("Missing routine grant: "+g);}

const expFns=names(baseline.functions,x=>`${x.schema}.${x.name}(${x.args??""})|${x.language}|${x.security_definer}|${x.definition}`);
const actFns=names(actualData.functions,x=>`${x.schema}.${x.name}(${x.args??""})|${x.language}|${x.security_definer}|${x.definition}`);
if(canonical(expFns)!==canonical(actFns)) fail("Function definitions/security mismatch.");
const expTrig=names(baseline.triggers.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.timing}|${x.event}|${x.orientation}|${x.definition}`);
const actTrig=names(actualData.triggers.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.timing}|${x.event}|${x.orientation}|${x.definition}`);
if(canonical(expTrig)!==canonical(actTrig)) fail("Trigger mismatch.");
const expPolicies=names(baseline.policies.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.cmd}|${JSON.stringify(x.roles)}|${x.using_expression??""}|${x.with_check??""}`);
const actPolicies=names(actualData.policies.filter(x=>x.schema==="public"),x=>`${x.table}|${x.name}|${x.cmd}|${JSON.stringify(x.roles)}|${x.using??""}|${x.check??""}`);
if(canonical(expPolicies)!==canonical(actPolicies)) fail("RLS policy mismatch.");
const expExt=names(baseline.extensions,x=>`${x.name}|${x.version}|${x.schema}`);
const actExt=names(actualData.extensions,x=>`${x.name}|${x.version}|${x.schema}`);
for(const e of expExt){if(!actExt.includes(e)) fail("Missing required extension: "+e);}
const expBuckets=names(baseline.storage_buckets,x=>`${x.id}|${x.name}|${x.public}|${x.file_size_limit}|${JSON.stringify(x.allowed_mime_types)}`);
const actBuckets=names(actualData.storage_buckets,x=>`${x.id}|${x.name}|${x.public}|${x.file_size_limit}|${JSON.stringify(x.allowed_mime_types)}`);
if(canonical(expBuckets)!==canonical(actBuckets)) fail("Storage bucket configuration mismatch.");
const expSP=names(baseline.storage_policies,x=>`${x.name}|${x.cmd}|${JSON.stringify(x.roles)}|${x.using_expression??""}|${x.with_check??""}`);
const actSP=names(actualData.storage_policies,x=>`${x.name}|${x.cmd}|${JSON.stringify(x.roles)}|${x.using??""}|${x.check??""}`);
if(canonical(expSP)!==canonical(actSP)) fail("Storage policy mismatch.");
const views=(actualData.views||[]).filter(x=>x.schema==="public" && x.name!=="storage.objects");
const expectedViews=(baseline.views||[]).filter(x=>x.schema==="public" && x.name!=="storage.objects" && !/\\bstorage\\.objects\\b/i.test(String(x.definition??"")));
if(JSON.stringify(names(expectedViews,x=>`${x.schema}.${x.name}|${x.definition}`))!==JSON.stringify(names(views,x=>`${x.schema}.${x.name}|${x.definition}`))) fail("View mismatch.");
console.log(JSON.stringify({
  PASS:true,
  tables:expectedTables.length,
  columns:expectedCols.length,
  constraints:expConstraints.length,
  indexes:expIndexes.length,
  functions:expFns.length,
  triggers:expTrig.length,
  rlsPolicies:expPolicies.length,
  extensions:expExt.length,
  storageBuckets:expBuckets.length,
  storagePolicies:expSP.length,
  minimumTableGrants:expTableGrants.length,
  minimumRoutineGrants:expRoutineGrants.length
},null,2));
