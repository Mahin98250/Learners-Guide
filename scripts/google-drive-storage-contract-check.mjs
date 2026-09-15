#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = (file) => {
  const full = path.join(root, file);
  check(fs.existsSync(full), `${file}: file is missing`);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
};

const migration = read("supabase/migrations/20260915120000_add_external_file_storage_metadata.sql");
const driveHelper = read("supabase/functions/_shared/googleDrive.ts");
const gateway = read("supabase/functions/file-storage/index.ts");
const client = read("src/lg/fileStorage.ts");
const config = read("supabase/config.toml");
const setupDoc = read("docs/google-drive-storage-integration.md");

check(/storage_provider\s+text\s+not null\s+default\s+'supabase'/i.test(migration), "migration: provider field is missing");
check(/storage_file_id\s+text/i.test(migration), "migration: storage_file_id is missing");
check(/storage_upload_id\s+uuid/i.test(migration), "migration: storage_upload_id is missing");
check(/storage_status\s+text\s+not null/i.test(migration), "migration: storage_status is missing");
check(/storage_checksum\s+text/i.test(migration), "migration: checksum field is missing");

check(/GOOGLE_CLIENT_ID/.test(driveHelper), "Google helper: GOOGLE_CLIENT_ID secret is missing");
check(/GOOGLE_CLIENT_SECRET/.test(driveHelper), "Google helper: GOOGLE_CLIENT_SECRET secret is missing");
check(/GOOGLE_REFRESH_TOKEN/.test(driveHelper), "Google helper: GOOGLE_REFRESH_TOKEN secret is missing");
check(/GOOGLE_DRIVE_ROOT_FOLDER_ID/.test(driveHelper), "Google helper: root-folder secret is missing");
check(/uploadType=resumable/.test(driveHelper), "Google helper: resumable upload support is missing");
check(/appProperties/.test(driveHelper), "Google helper: application file binding metadata is missing");
check(/md5Checksum/.test(driveHelper), "Google helper: provider checksum verification is missing");
check(/storageQuotaExceeded|429|503/.test(driveHelper) || /500, 502, 503, 504/.test(driveHelper), "Google helper: transient failure handling is missing");

check(/auth\.getUser/.test(gateway), "Gateway: Supabase bearer-token verification is missing");
check(/from\(entity\)[\s\S]*?maybeSingle/.test(gateway), "Gateway: RLS-visible record authorization check is missing");
check(/finalize-upload/.test(gateway), "Gateway: upload finalization is missing");
check(/verifyDriveUpload/.test(gateway), "Gateway: server-side Drive verification is missing");
check(/storage_status:\s*["']complete["']/.test(gateway), "Gateway: completed storage state is missing");
check(/trashed:\s*true/.test(driveHelper), "Gateway: safe Drive trash operation is missing");

check(!/GOOGLE_CLIENT_SECRET|GOOGLE_REFRESH_TOKEN|SERVICE_ACCOUNT|private_key/i.test(client), "Frontend: server-only Google credentials must never appear in client code");
check(!/supabase\.storage\.from/.test(client), "Frontend storage adapter: must not call Supabase Storage directly");
check(/functions\/file-storage/.test(client), "Frontend storage adapter: secure file gateway endpoint is missing");
check(/Content-Range/.test(client), "Frontend storage adapter: resumable upload ranges are missing");
check(/maxTransientRetries/.test(client), "Frontend storage adapter: bounded upload retry policy is missing");

check(/\[functions\.file-storage\][\s\S]*?verify_jwt\s*=\s*true/i.test(config), "Supabase config: file-storage gateway must require JWT verification");
check(/Supabase Auth/.test(setupDoc) && /Google Drive/.test(setupDoc), "Integration documentation is missing core architecture");
check(/Supabase Auth \+ RLS/.test(setupDoc), "Integration documentation must preserve Supabase authorization as the source of truth");

if (failures.length) {
  console.error("Google Drive storage contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Google Drive storage contract checks passed.");
