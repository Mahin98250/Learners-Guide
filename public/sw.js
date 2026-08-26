const CACHE = "learners-guide-v18";
const APP_SHELL = ["./", "./manifest.webmanifest", "./learner-guide-logo.jpg?v=1"];
const APP_SCOPE = self.registration?.scope || self.location.href;
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

function appUrl(value) {
  const raw = String(value || "app");
  if (/^https?:\/\//i.test(raw)) return raw;
  const relative = raw.replace(/^\/+/, "");
  return new URL(relative || "app", APP_SCOPE).href;
}

async function putInCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") return response;
  try {
    const copy = response.clone();
    const cache = await caches.open(CACHE);
    await cache.put(request, copy);
  } catch {}
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text?.() || "" }; }
    await self.registration.showNotification(payload.title || "Learner's Guide", { body: payload.body || "You have a new notification.", tag: payload.notificationId || `lg-${Date.now()}`, renotify: true, requireInteraction: false, vibrate: [150, 80, 150], timestamp: Date.now(), data: { url: appUrl(payload.url || "app"), notificationId: payload.notificationId || null } });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = appUrl(event.notification.data?.url || "app");
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) { if ("focus" in client) { await client.focus(); if ("navigate" in client && client.url !== target) await client.navigate(target); return; } }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/auth/v1/") || url.pathname.includes("/functions/v1/")) return;
  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => putInCache(request, response))));
    return;
  }
  event.respondWith(fetch(request, { cache: "no-cache" }).then((response) => putInCache(request, response)).catch(() => caches.match(request).then((cached) => cached || caches.match("./"))));
});
