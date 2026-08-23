import { createClient } from "@supabase/supabase-js";

// Learner's Guide backend (existing project). The publishable anon key is safe
// in client code; row level security is what protects the data.
export const SB_URL = "https://efnxjfzyqbdulpjhffsm.supabase.co";
export const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmbnhqZnp5cWJkdWxwamhmZnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzOTU0OTIsImV4cCI6MjA4ODk3MTQ5Mn0.0otuaZUmethVmtj_NOkz1AzEGbYB0yM0_ZcRatbWvs4";

const AUTH_STORAGE_KEY = "lg-auth";

export const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});

// A stale/revoked refresh token should not leave this app repeatedly sending
// failing refresh requests. Remove only this app's stored auth state.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" && typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
});

export function clearInvalidAuthSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
