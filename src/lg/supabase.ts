import { createClient } from "@supabase/supabase-js";

// Learner's Guide backend (existing project). The publishable anon key is safe
// in client code; row level security is what protects the data.
export const SB_URL = "https://efnxjfzyqbdulpjhffsm.supabase.co";
export const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmbnhqZnp5cWJkdWxwamhmZnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzOTU0OTIsImV4cCI6MjA4ODk3MTQ5Mn0.0otuaZUmethVmtj_NOkz1AzEGbYB0yM0_ZcRatbWvs4";

const AUTH_STORAGE_KEY = "lg-auth";
let recoveryInProgress = false;

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});

function clearStoredAuth() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

// Supabase refresh tokens are single-use. When a revoked/stale token is
// rejected, discard only this app's persisted session so the next login starts
// cleanly instead of repeatedly sending the same invalid refresh token.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    clearStoredAuth();
    return;
  }

  if (event === "TOKEN_REFRESHED" && session) {
    recoveryInProgress = false;
  }

  if (event === "SIGNED_IN" && session) {
    recoveryInProgress = false;
  }
});

export function clearInvalidAuthSession() {
  if (recoveryInProgress) return;
  recoveryInProgress = true;
  clearStoredAuth();
  void supabase.auth.signOut({ scope: "local" }).catch(() => {});
  window.setTimeout(() => {
    recoveryInProgress = false;
  }, 1000);
}

export function isInvalidRefreshTokenError(error: unknown) {
  const candidate = error as { message?: unknown } | null;
  const message = String(
    candidate && typeof candidate === "object" ? candidate.message || "" : error || "",
  ).toLowerCase();
  return message.includes("invalid refresh token") ||
    message.includes("refresh_token_not_found") ||
    message.includes("refresh token not found");
}
