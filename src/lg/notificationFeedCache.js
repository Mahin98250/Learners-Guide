const CACHE_TTL_MS = 5_000;
const cache = new Map();
const inflight = new Map();

const keyOf = userId => String(userId || "");

export function getCachedNotificationFeed(userId) {
  const key = keyOf(userId);
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.time >= CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedNotificationFeed(userId, value) {
  const key = keyOf(userId);
  if (!key) return value;
  cache.set(key, { time: Date.now(), value });
  return value;
}

export function getInflightNotificationFeed(userId) {
  return inflight.get(keyOf(userId)) || null;
}

export function setInflightNotificationFeed(userId, promise) {
  const key = keyOf(userId);
  if (!key) return promise;
  inflight.set(key, promise);
  return promise;
}

export function clearNotificationFeedCache(userId) {
  if (userId == null) {
    cache.clear();
    inflight.clear();
    return;
  }
  const key = keyOf(userId);
  cache.delete(key);
  inflight.delete(key);
}

export { CACHE_TTL_MS };
