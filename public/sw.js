/**
 * NADI — PWA Service Worker Cache Engine
 * =====================================
 * Cache-first strategy for static assets, Google Fonts, icons, and CSS/JS bundles.
 * Network-first strategy for API routes to guarantee fresh telemetry.
 */

const CACHE_NAME = 'nadi-v3.5.0-cache';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.jpg',
  '/icon.jpg',
  '/logo.png',
  '/images/malaysia-flag.png'
];

// Install Event — Pre-cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up stale caches
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

// Fetch Event — Network-first for APIs, Cache-first for Static Assets & Fonts
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests or browser extensions
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Network-first for API routes & Supabase requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first strategy for static assets, Google Fonts & images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for stale assets
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse.status === 200 &&
          (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|css|js|woff2)$/) ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
