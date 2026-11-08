// Bump on every change to this file's caching behavior: activating a new name deletes the old
// caches, including pages the previous version stored.
const CACHE_NAME = "loop-cache-v3";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldKeys = keys.filter((key) => key !== CACHE_NAME);
      await Promise.all(oldKeys.map((key) => caches.delete(key)));
      await self.clients.claim();
      // No forced reload of open pages here: `WindowClient.navigate()` from `activate` closed the
      // whole headless Chromium in testing. Pages are network first (see `fetch`), so the next
      // visit already shows the new version.
    }),
  );
});

const putInCache = (request, response) => {
  if (response && response.status === 200 && response.type === "basic") {
    const clonedResponse = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clonedResponse));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // The caching below must never apply to the API: today it lives on a different origin so its
  // responses are `cors` and never `basic` (see `putInCache`), but that is an accident of
  // deployment, not a guarantee. Every non-`GET` is excluded on its own merits regardless of path.
  if (event.request.method !== "GET" || url.pathname.startsWith("/api")) {
    return;
  }

  // Pages: network first, so a deploy shows up on the next visit. The cache is only the offline
  // fallback. Serving pages from the cache first kept people on the previous version until a
  // second reload.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => putInCache(event.request, response))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // Everything else (hashed bundles, fonts, images): cache first, refreshed in the background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((response) => putInCache(event.request, response))
        .catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    }),
  );
});
