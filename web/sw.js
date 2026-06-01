// Service Worker — cache simple para que la app funcione offline
const CACHE = "antesodespues-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./events.js",
  "./game.js",
  "./manifest.json",
  "./img/logo.png",
  "./img/banner.png",
  "./img/fondo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Solo cacheamos misma origen y GET
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
