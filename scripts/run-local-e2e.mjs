import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const migrations = resolve(root, "supabase/migrations");
const quarantine = resolve(root, "supabase/migrations.e2e-quarantine");
const bootstrapSql = resolve(root, "supabase/qa/bootstrap/production-derived-bootstrap.sql");

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${signal || code}`));
    });
  });
}

function runCapture(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stderr || stdout}`));
    });
  });
}

function requireLocalUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.hostname.includes("efnxjfzyqbdulpjhffsm")) {
    throw new Error(`[E2E safety] ${label} is not local: ${url.origin}`);
  }
}

let migrationsQuarantined = false;
let supabaseStarted = false;

try {
  await run("node", ["scripts/check-local-e2e-prereqs.mjs"]);

  if (existsSync(quarantine)) throw new Error("[E2E] Existing migration quarantine found; refusing to continue.");
  if (!existsSync(migrations)) throw new Error("[E2E] supabase/migrations is missing.");

  // Never inherit hosted Supabase targets into the local browser build.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;

  await run("node", ["tests/e2e/bootstrap/validate-fixture-contract.mjs"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "lint:eslint"]);
  await run("npm", ["run", "typecheck"]);

  renameSync(migrations, quarantine);
  mkdirSync(migrations, { recursive: true });
  migrationsQuarantined = true;

  await run("node", ["supabase/qa/bootstrap/generate-bootstrap.mjs"]);
  await run("node", ["supabase/qa/bootstrap/validate-bootstrap-sql.mjs"]);
  await run("npx", ["supabase@2.117.0", "start"]);
  supabaseStarted = true;

  const status = await runCapture("npx", ["supabase@2.117.0", "status", "-o", "env"]);
  const serverEnv = Object.fromEntries(
    status.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
  );

  requireLocalUrl(serverEnv.API_URL, "Supabase API URL");
  requireLocalUrl(`http://${new URL(serverEnv.API_URL).hostname}:54322`, "Supabase DB host");

  const localEnv = {
    ...process.env,
    E2E_MODE: "local",
    E2E_BASE_URL: "http://127.0.0.1:4173",
    E2E_SUPABASE_URL: serverEnv.API_URL,
    VITE_SUPABASE_URL: serverEnv.API_URL,
    VITE_SUPABASE_ANON_KEY: serverEnv.ANON_KEY,
    SUPABASE_URL: serverEnv.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: serverEnv.SERVICE_ROLE_KEY,
    E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD || randomBytes(24).toString("base64url"),
    PLAYWRIGHT_HTML_OPEN: "never",
  };

  await run("psql", [serverEnv.DB_URL, "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-f", bootstrapSql], { env: localEnv });
  await run("node", ["supabase/qa/bootstrap/verify-bootstrap.mjs"], { env: localEnv });
  await run("node", ["tests/e2e/bootstrap/seed-local.mjs"], { env: localEnv });
  await run("node", ["tests/e2e/bootstrap/seed-domain-data.mjs"], { env: localEnv });

  await run("npm", ["run", "build"], { env: localEnv });
  await run("npm", ["run", "test:e2e:security", "--", "--project=desktop-chromium"], { env: localEnv });
  await run("npx", ["playwright", "test", "--project=desktop-chromium", "--project=mobile-chromium", "--grep-invert", "@security"], { env: localEnv });
} finally {
  if (supabaseStarted) {
    await run("npx", ["supabase@2.117.0", "stop", "--no-backup"]).catch((error) => console.error(error.message));
  }
  if (migrationsQuarantined) {
    rmSync(migrations, { recursive: true, force: true });
    renameSync(quarantine, migrations);
  }
}
