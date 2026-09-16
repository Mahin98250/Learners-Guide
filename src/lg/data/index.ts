import { supabase } from "@/lg/supabase";
import { clearMemoryCache } from "./cache";
import { clearStoredTable, lsG, lsS } from "./storage";
import { TABLES } from "./queries";
export * from "./constants";
export * from "./storage";
export * from "./cache";
export { TABLES, gdb, hydrateForRole, selectForTable } from "./queries";
export { addR, updR, delR, sdb, hydrateAll } from "./mutations";

/** Clears both memory and legacy browser caches after an auth boundary changes. */
export const clearCache=():void=>{clearMemoryCache();for(const table of TABLES)clearStoredTable(table)};

if(typeof window!=="undefined")supabase.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")clearCache()});