import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration=fs.readFileSync("supabase/migrations/20260922270000_phase4_admin_onboarding_communications.sql","utf8");
const invite=fs.readFileSync("supabase/functions/platform-invite-admin/index.ts","utf8");
const owner=fs.readFileSync("src/platform/PlatformOwnerPortal.tsx","utf8");
const admin=fs.readFileSync("src/admin/ModernAdminPortal.tsx","utf8");
const accept=fs.readFileSync("src/routes/auth.tsx","utf8");
const inbox=fs.readFileSync("src/admin/PlatformInboxPage.tsx","utf8");

test("Phase 4 onboarding is MFA-protected and auditable",()=>{
  for(const fn of ["platform_create_admin_invitation","platform_finalize_admin_invitation","platform_revoke_admin_invitation"]){
    assert.match(migration,new RegExp("create or replace function public\\."+fn));
    assert.match(migration,new RegExp(fn+"[\\s\\S]{0,1200}platform_owner_access_ok\\(\\)"));
  }
  assert.match(migration,/platform_accept_admin_invitation/);
  assert.match(migration,/status='invited'/);
  assert.match(migration,/status='accepted'/);
  assert.match(invite,/inviteUserByEmail/);
  assert.match(invite,/platform_finalize_admin_invitation/);
  assert.match(invite,/platform_revoke_admin_invitation/);
});

test("Platform messages target only institute administrators and create notifications",()=>{
  assert.match(migration,/platform_send_institute_admin_message/);
  assert.ok(migration.includes("r.role_key in ('institute_admin','institute_owner')"));
  assert.match(migration,/insert into public.notifications/);
  assert.match(migration,/platform_message/);
  assert.match(migration,/platform_get_my_institute_messages/);
  assert.match(migration,/platform_mark_institute_message_read/);
});

test("Owner and Admin surfaces are wired to communications",()=>{
  assert.match(owner,/platform_send_institute_admin_message/);
  assert.match(owner,/platform-invite-admin/);
  assert.match(owner,/Message institute administrators/);
  assert.match(owner,/Invite institute administrator/);
  assert.match(admin,/Platform Inbox/);
  assert.match(admin,/NotifPanel/);
  assert.match(inbox,/platform_get_my_institute_messages/);
  assert.match(accept,/admin-invite/);
  assert.match(accept,/platform_accept_admin_invitation/);
});

console.log("Phase 4 onboarding and communications contract checks passed.");
