import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("platform branding is Mahin while Learner's Guide remains tenant branding", () => {
  assert.match(read("index.html"), /<title>Mahin<\/title>/);
  assert.match(read("public/manifest.webmanifest"), /"name": "Mahin"/);
  assert.match(read("src/routes/index.tsx"), /Mahin — Education Platform for Institutes/);
  assert.match(read("src/platform/PlatformOwnerLogin.tsx"), /MAHIN/);
  assert.match(read("src/lg/LoginScreen.jsx"), /tenant\?\.display_name \|\| tenant\?\.name \|\| "Mahin"/);
  assert.match(read("src/lg/authscreens.tsx"), /tenant\?\.display_name \|\| tenant\?\.name \|\| "Mahin"/);
  assert.match(read("supabase/migrations/20260922200000_temporary_platform_brand_mahin.sql"), /product_name = 'Mahin'/);
  assert.match(read("supabase/migrations/20260922200000_temporary_platform_brand_mahin.sql"), /Learner''s Guide/);
});
