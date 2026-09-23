import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const rootRoute = read("src/routes/__root.tsx");
const startup = read("src/StartupMinimal.tsx");
const parent = read("src/lg/parentWorkflows.jsx");

test("App shell preconnects directly to Supabase", () => {
  assert.match(rootRoute, /import \{ SB_URL \} from "@\/lg\/supabase";/);
  assert.match(rootRoute, /\{ rel: "preconnect", href: SB_URL \}/);
  assert.match(rootRoute, /\{ rel: "dns-prefetch", href: SB_URL \}/);
});

test("Startup overlay does not add a long artificial delay", () => {
  assert.match(startup, /window\.setTimeout\(\(\) => setExiting\(true\), 140\)/);
  assert.match(startup, /transition:opacity 140ms/);
});

test("Parent dashboard keeps the database payload narrow and memoizes expensive derived views", () => {
  assert.doesNotMatch(parent, /from\("students"\)\.select\("\*"\)/);
  assert.doesNotMatch(parent, /from\("attendance"\)\.select\("\*"\)/);
  assert.doesNotMatch(parent, /from\("fees"\)\.select\("\*"\)/);
  assert.doesNotMatch(parent, /from\("homework"\)\.select\("\*"\)/);
  assert.match(parent, /const childMemberships = useMemo\(/);
  assert.match(parent, /const childTimetable = useMemo\(/);
  assert.match(parent, /const averagePercentage = useMemo\(/);
});
