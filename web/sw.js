// ATLAS politics — Service Worker
// Estrategia: stale-while-revalidate para data/web/* y catalogs/*
// network-first para HTML/JS/CSS (siempre fresco)
const CACHE = "atlas-v1-20260519";
const PRECACHE = [
  "/web/",
  "/web/index.html",
  "/web/css/app.css",
  "/web/js/app.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Solo same-origin
  if (url.origin !== location.origin) return;
  const isData = url.pathname.includes("/data/web/") || url.pathname.includes("/catalogs/");
  const isHtml = e.request.destination === "document" || url.pathname.endsWith(".html");
  if (isData) {
    // Stale-while-revalidate: devuelve cache + actualiza en background
    e.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then(resp => {
        if (resp.ok) cache.put(e.request, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || network;
    }));
  } else if (isHtml) {
    // Network-first para HTML
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
  }
});
