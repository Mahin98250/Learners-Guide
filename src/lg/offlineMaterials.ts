const CACHE_NAME = "learners-guide-study-materials-v2";
const STORAGE_PATH = "/storage/v1/object/";
const STATE_EVENT = "learners-guide:offline-state";
let installed = false;

function isMaterialRequest(input: RequestInfo | URL) {
  try {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return url.pathname.includes(STORAGE_PATH) && url.pathname.includes("/materials/");
  } catch {
    return false;
  }
}

function announce() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { online: navigator.onLine } }));
}

export function installOfflineMaterialCache() {
  if (typeof window === "undefined" || !("caches" in window) || installed) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.addEventListener("online", announce, { passive: true });
  window.addEventListener("offline", announce, { passive: true });

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isMaterialRequest(input)) return originalFetch(input, init);
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

  announce();
}

export async function getOfflineMaterial(request: RequestInfo | URL) {
  if (typeof caches === "undefined" || !isMaterialRequest(request)) return null;
  const cache = await caches.open(CACHE_NAME);
  return cache.match(request);
}

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function subscribeOfflineState(listener: (online: boolean) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ online?: boolean }>).detail;
    listener(detail?.online ?? navigator.onLine);
  };
  window.addEventListener(STATE_EVENT, handler);
  listener(navigator.onLine);
  return () => window.removeEventListener(STATE_EVENT, handler);
}
