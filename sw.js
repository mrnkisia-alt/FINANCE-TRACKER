/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER — sw.js
   Caches all app files so the tracker works fully OFFLINE.
   Strategy: Cache-first (serve from cache, update in background).
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = "finance-tracker-v1";

// All files to pre-cache on install
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./icon-512.png",
    "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap"
    // NOTE: data.json is intentionally excluded — it changes on every save
];

// ─── INSTALL: pre-cache all assets ───────────────────────────
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// ─── ACTIVATE: remove old caches ─────────────────────────────
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ─── FETCH: cache-first strategy ─────────────────────────────
self.addEventListener("fetch", (event) => {
    // Only handle GET requests
    if (event.request.method !== "GET") return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            // Serve from cache immediately, then update cache in background
            const networkFetch = fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => cached); // offline fallback

            return cached || networkFetch;
        })
    );
});
