/**
 * Backwards-compatible public data API.
 *
 * Existing imports intentionally continue to use `@/lg/data`; implementation
 * details now live in focused modules so UI code does not depend on one monolith.
 */
import { supabase } from "@/lg/supabase";
import { clearMemoryCache } from "./data/cache";
import { clearStoredTable } from "./data/storage";
import { TABLES } from "./data/queries";
export * from "./data/constants";
export * from "./data/storage";
export * from "./data/cache";
export { TABLES, gdb, hydrateForRole, selectForTable } from "./data/queries";
export { addR, updR, delR, sdb, hydrateAll } from "./data/mutations";

/** Clears in-memory and legacy browser caches after authentication changes. */
export const clearCache = (): void => {
  clearMemoryCache();
  for (const table of TABLES) clearStoredTable(table);
};

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") clearCache();
  });
}
