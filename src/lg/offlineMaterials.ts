const CACHE_NAME = "learners-guide-study-materials-v1";
const STORAGE_PATH = "/storage/v1/object/";

function isMaterialRequest(input: RequestInfo | URL) {
  try {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return url.pathname.includes(STORAGE_PATH) && url.pathname.includes("/materials/");
  } catch {
    return false;
  }
}

export function installOfflineMaterialCache() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const material = isMaterialRequest(input);
    if (!material) return originalFetch(input, init);
    const request = new Request(input, init);
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await originalFetch(request);
      if (response.ok) void cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  };
}

export async function getOfflineMaterial(request: RequestInfo | URL) {
  if (typeof caches === "undefined" || !isMaterialRequest(request)) return null;
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}
