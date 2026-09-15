import { spawnSync } from "node:child_process";

const required = [
  ["node", ["--version"], "Node.js"],
  ["npx", ["--version"], "npx"],
  ["docker", ["--version"], "Docker"],
  ["psql", ["--version"], "PostgreSQL client (psql)"],
];

const failures = [];
for (const [command, args, label] of required) {
  const result = spawnSync(command, args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(`${label}: ${result.error?.message || result.stderr?.trim() || "command unavailable"}`);
  } else {
    const version = (result.stdout || result.stderr || "").trim().split(/\r?\n/)[0];
    console.log(`[E2E preflight] ${label}: ${version}`);
  }
}

if (failures.length) {
  console.error("\n[E2E preflight] BLOCKED — install the missing local prerequisites before running the isolated Supabase E2E suite:");
  for (const failure of failures) console.error(` - ${failure}`);
  console.error("\nRequired stack: Docker Engine/Desktop + PostgreSQL client + Node.js/npm.");
  console.error("This guard intentionally does not install software or contact production services.");
  process.exit(1);
}

console.log("[E2E preflight] PASS — local execution prerequisites are available.");
