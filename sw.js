// Офлайн-режим: сначала сеть (чтобы сразу видеть обновления), без сети — из кэша.
const CACHE = "orfograf-v20";
const CORE = ["./", "index.html", "app.js", "data.js", "skins.js", "medals.js", "cosmetics.js", "theory.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.includes("/rest/v1/")) return;
  e.respondWith(
    fetch(e.request.url.startsWith(self.location.origin) ? new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" }) : e.request).then(r => {
      if (r && (r.ok || r.type === "opaque")) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
