const CACHE_NAME = "kitai-cache-v45";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/vocab.json",
  "./data/hiragana.json",
  "./data/katakana.json",
  "./pwa/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never touch cross-origin requests (Wikimedia photos, Supabase images,
  // online TTS). Caching an <img> load stores an OPAQUE response, which then
  // breaks a later fetch().blob() of the same URL (e.g. the "Find Photos"
  // picker). Let the browser handle these normally.
  if (!sameOrigin) return;

  // Network-first for the app shell (HTML/CSS/JS) and data files so updates
  // land as soon as the device is online. Falls back to cache when offline.
  const isAppShell =
    sameOrigin &&
    (request.mode === "navigate" ||
      /\.(?:html|js|css)$/.test(url.pathname) ||
      url.pathname.includes("/data/"));

  if (isAppShell) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for everything else (images, SVG art, fonts, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((resp) => {
          if (request.destination === "image") {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
