const MEMORY_CACHE_TTL_MS=15_000;type CacheEntry<T>={value:T;expiresAt:number};const memoryCache=new Map<string,CacheEntry<unknown>>();
export const clearMemoryCache=():void=>memoryCache.clear();
export const invalidateMemoryCache=(table?:string):void=>{if(table)memoryCache.delete(table);else memoryCache.clear()};
export const setMemoryCache=<T>(table:string,value:T):T=>{memoryCache.set(table,{value,expiresAt:Date.now()+MEMORY_CACHE_TTL_MS});return value};
export const getMemoryCache=<T>(table:string):T|null=>{const hit=memoryCache.get(table) as CacheEntry<T>|undefined;if(!hit)return null;if(hit.expiresAt<=Date.now()){memoryCache.delete(table);return null}return hit.value};