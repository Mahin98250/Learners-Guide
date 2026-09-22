const MEMORY_CACHE_TTL_MS=15_000;
type CacheEntry<T>={value:T;expiresAt:number};
const memoryCache=new Map<string,CacheEntry<unknown>>();

export const clearMemoryCache=():void=>memoryCache.clear();

export const invalidateMemoryCache=(scope?:string):void=>{
  if(!scope){memoryCache.clear();return}
  for(const key of memoryCache.keys()){
    if(key===scope||key.startsWith(`${scope}::`))memoryCache.delete(key);
  }
};

export const setMemoryCache=<T>(key:string,value:T,ttlMs:number=MEMORY_CACHE_TTL_MS):T=>{
  memoryCache.set(key,{value,expiresAt:Date.now()+Math.max(0,ttlMs)});
  return value;
};

export const getMemoryCache=<T>(key:string):T|null=>{
  const hit=memoryCache.get(key) as CacheEntry<T>|undefined;
  if(!hit)return null;
  if(hit.expiresAt<=Date.now()){memoryCache.delete(key);return null}
  return hit.value;
};
