/**
 * NADI — PWA Service Worker Cache Engine (v4.0.0)
 * ===============================================
 * - Strictly same-origin: NEVER intercepts cross-origin CDN tiles (Carto, OSM, Open-Meteo, Supabase).
 * - Cache-first strategy for static assets (icons, manifest, app shell).
 * - Network-first strategy for internal API routes.
 * - Robust try/catch fallback to prevent unhandled fetch rejections.
 */

const CACHE_NAME = 'nadi-v4.1.0-cache';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.jpg',
  '/icon.jpg',
  '/logo.png',
  '/images/malaysia-flag.png'
];

// Install Event — Pre-cache core shell assets safely without atomic failure
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset);
            if (res.ok) {
              await cache.put(asset, res);
            }
          } catch {
            // Non-critical asset failure — never abort SW install
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up stale caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Network-first for APIs, Cache-first for Static Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. MUST BE SAME ORIGIN — Let Carto tiles, OSM, Supabase, OpenWeather, Groq pass through natively!
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Skip non-GET requests or unsupported schemes
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 3. Network-first for internal API routes with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // 4. Cache-first with stale-while-revalidate for local static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Background revalidation
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|css|js|woff2|json)$/)
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return caches.match(event.request);
        });
    })
  );
});
