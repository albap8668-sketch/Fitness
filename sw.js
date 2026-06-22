// FitnessTracker Service Worker v3
const CACHE = "fitness-v3";
const ASSETS = [
  "/Fitness/FitnessTracker.html",
  "/Fitness/manifest.json",
  "/Fitness/icon-180.png",
  "/Fitness/icon-192.png",
  "/Fitness/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).then(res => {
      if(!res || res.status !== 200 || res.type === "opaque") return res;
      const clone = res.clone();
      caches.open(CACHE).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
