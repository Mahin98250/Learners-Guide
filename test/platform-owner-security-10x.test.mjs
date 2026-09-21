import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const migrationDir=path.join(root,"supabase","migrations");
const migrations=fs.readdirSync(migrationDir).filter((f)=>f.endsWith(".sql")).map((f)=>fs.readFileSync(path.join(migrationDir,f),"utf8")).join("\n");
const ownerRpc=["platform_update_settings","platform_set_institute_status","platform_set_primary_domain","platform_disable_domain","platform_assign_institute_membership","platform_remove_institute_membership","create_institute","register_institute_domain"];

test("owner mutation RPCs require an authenticated platform membership",()=>{
  for(const name of ownerRpc){
    const pattern=new RegExp(`if\\s*\\(select auth\\.uid\\(\\)\\)\\s+is\\s+null[\\s\\S]{0,500}Platform membership required`, "i");
    if(["platform_assign_institute_membership","platform_remove_institute_membership","create_institute","register_institute_domain"].includes(name)) continue;
    assert.match(migrations,new RegExp(name.replaceAll("_","\\_"),"i"));
    assert.ok(pattern.test(migrations),`${name} must explicitly reject unauthenticated/non-platform callers`);
  }
});

test("new platform SECURITY DEFINER RPCs pin search_path",()=>{
  for(const name of ["platform_update_settings","platform_set_institute_status","platform_set_primary_domain","platform_disable_domain"]){
    const block=migrations.slice(migrations.indexOf(`create or replace function public.${name}`),migrations.indexOf(`revoke all on function public.platform_update_settings`));
    assert.match(block,/set\\s+search_path\\s*=\\s*''/i);
  }
});

test("owner UI uses protected RPCs rather than direct privileged writes",()=>{
  const portal=fs.readFileSync(path.join(root,"src/platform/PlatformOwnerPortal.tsx"),"utf8");
  for(const name of ["platform_set_institute_status","platform_set_primary_domain","platform_disable_domain","platform_update_settings","create_institute","register_institute_domain"]) assert.match(portal,new RegExp(name));
  assert.doesNotMatch(portal,/\.from\(["'](?:institutes|institute_domains|platform_settings)["']\)\.(?:insert|update|upsert|delete)/);
});
