import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

test("Performance: admin analytics keeps bounded explicit projections", () => {
  const source = read("src/admin/AdminAnalytics.tsx");
  assert.doesNotMatch(source, /supabase\.from\(\s*["']students["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /supabase\.from\(\s*["']teachers["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /supabase\.from\(\s*["']attendance["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /supabase\.from\(\s*["']marks["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.match(source, /DASHBOARD_SELECTS/);
  assert.match(source, /PROFILE_DETAIL_SELECTS/);
});

test("Performance: shared data layer coalesces concurrent table reads", () => {
  const source = read("src/lg/data.js");
  assert.match(source, /const inflight=new Map/);
  assert.match(source, /inflight\.has\(t\)/);
  assert.match(source, /inflight\.set\(t,request\)/);
  assert.match(source, /inflight\.delete\(t\)/);
});

test("Performance: shared memory cache has a bounded TTL and is reset on auth session changes", () => {
  const source = read("src/lg/data.js");
  assert.match(source, /const MEMORY_CACHE_TTL_MS=15_000/);
  assert.match(source, /expiresAt:Date\.now\(\)\+MEMORY_CACHE_TTL_MS/);
  assert.match(source, /supabase\.auth\.onAuthStateChange\(event=>\{if\(event===\"SIGNED_IN\"\|\|event===\"SIGNED_OUT\"\)clearCache\(\)\}\)/);
});

test("Performance: student timetable relies on the shared cache path", () => {
  const source = read("src/lg/student.jsx");
  assert.doesNotMatch(source, /const timetableCache=new Map/);
  assert.match(source, /gdb\("timetable"\)/);
});

test("Performance: known retired/compatibility path does not reintroduce wildcard profile reads", () => {
  const source = read("src/admin/AdminProfilePage.tsx");
  assert.doesNotMatch(source, /from\(\s*["']students["']\s*\)\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(source, /from\(\s*["']teachers["']\s*\)\.select\(\s*["']\*["']\s*\)/);
});
