import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const dataSource = [
  read("src/lg/data.js"),
  read("src/lg/data/index.ts"),
  read("src/lg/data/constants.ts"),
  read("src/lg/data/cache.ts"),
  read("src/lg/data/storage.ts"),
  read("src/lg/data/queries.js"),
  read("src/lg/data/mutations.js"),
].join("\n");

test("shared data loader has a bounded in-memory cache", () => {
  assert.match(dataSource, /MEMORY_CACHE_TTL_MS=15_000/);
  assert.match(dataSource, /const memoryCache=new Map\(\)/);
  assert.match(dataSource, /getMemoryCache\(t\)/);
  assert.match(dataSource, /setMemoryCache\(t,rows\)/);
});

test("cache invalidates after CRUD writes and full clear", () => {
  assert.match(dataSource, /memoryCache\.clear\(\)/);
  assert.match(dataSource, /invalidateMemoryCache\(t\)/);
  assert.match(dataSource, /export const clearCache=/);
  assert.match(dataSource, /export const addR=.*?invalidateMemoryCache\(t\)/s);
  assert.match(dataSource, /export const updR=.*?invalidateMemoryCache\(t\)/s);
  assert.match(dataSource, /export const delR=.*?invalidateMemoryCache\(t\)/s);
});

test("timetable keeps role-scoped query behavior while using the shared cache", () => {
  assert.match(dataSource, /const cached=getMemoryCache\("timetable"\)/);
  assert.match(dataSource, /\.eq\("status","active"\)/);
  assert.match(dataSource, /role==="teacher"&&ref/);
  assert.match(dataSource, /role==="student"\|\|role==="parent"/);
});

test("portal hydration continues to tolerate individual table failures", () => {
  assert.match(dataSource, /Promise\.allSettled\(tables\.map\(t=>gdb\(t\)\)\)/);
  assert.match(dataSource, /Unable to synchronize all required portal data/);
});
