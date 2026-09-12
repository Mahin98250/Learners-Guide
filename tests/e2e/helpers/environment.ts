const PRODUCTION_APP_HOSTS = new Set(["learners-guide.vercel.app"]);
const PRODUCTION_SUPABASE_HOSTS = new Set(["efnxjfzyqbdulpjhffsm.supabase.co"]);
const PRODUCTION_SUPABASE_REF = "efnxjfzyqbdulpjhffsm";

function parseUrl(value: string, label: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`[E2E safety] ${label} is not a valid URL: ${value}`);
  }
}

export function assertLocalE2ETargets() {
  const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
  const app = parseUrl(baseURL, "E2E_BASE_URL");

  if (PRODUCTION_APP_HOSTS.has(app.hostname)) {
    throw new Error(`[E2E safety] Refusing production application target: ${app.hostname}`);
  }

  if (!((app.protocol === "http:" || app.protocol === "https:") &&
        (app.hostname === "127.0.0.1" || app.hostname === "localhost"))) {
    throw new Error(`[E2E safety] E2E_BASE_URL must target localhost/127.0.0.1, received ${app.origin}`);
  }

  const supabaseURL = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseURL) {
    throw new Error("[E2E safety] E2E_SUPABASE_URL or VITE_SUPABASE_URL is required for local E2E runs.");
  }

  const supabase = parseUrl(supabaseURL, "E2E_SUPABASE_URL/VITE_SUPABASE_URL");
  if (PRODUCTION_SUPABASE_HOSTS.has(supabase.hostname) || supabase.hostname.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error(`[E2E safety] Refusing production Supabase target: ${supabase.origin}`);
  }

  if (!(supabase.protocol === "http:" &&
        (supabase.hostname === "127.0.0.1" || supabase.hostname === "localhost"))) {
    throw new Error(`[E2E safety] Supabase E2E target must be local HTTP, received ${supabase.origin}`);
  }
}
