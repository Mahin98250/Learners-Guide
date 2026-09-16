/** Browser cache adapter. Supabase remains the source of truth. */
const hasLocalStorage=():boolean=>typeof window!=="undefined"&&Boolean(window.localStorage);
const storageKey=(table:string):string=>`lg_${table}`;
export const lsG=<T=unknown>(table:string):T[]=>{if(!hasLocalStorage())return[];try{const raw=localStorage.getItem(storageKey(table));const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed as T[]:[]}catch{return[]}};
export const lsS=(table:string,value:unknown):void=>{if(!hasLocalStorage())return;try{localStorage.setItem(storageKey(table),JSON.stringify(value))}catch{}};
export const clearStoredTable=(table:string):void=>{if(!hasLocalStorage())return;try{localStorage.removeItem(storageKey(table))}catch{}};