#!/usr/bin/env node
const raw=process.env.SUPABASE_URL||process.env.E2E_SUPABASE_URL||"";
if(!raw) throw new Error("[QA safety] SUPABASE_URL/E2E_SUPABASE_URL is required.");
let url;
try{url=new URL(raw)}catch{throw new Error("[QA safety] Invalid Supabase URL.");}
const allowedHosts=new Set(["127.0.0.1","localhost"]);
if(!allowedHosts.has(url.hostname) || url.protocol!=="http:"){
  throw new Error(`[QA safety] Refusing non-local Supabase target: ${url.origin}`);
}
if(raw.includes("efnxjfzyqbdulpjhffsm")) throw new Error("[QA safety] Production Supabase ref detected.");
console.log("[QA safety] Local Supabase target verified.");
