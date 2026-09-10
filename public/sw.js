/**
 * NADI PWA Service Worker Engine (v4.5.0)
 * 
 * - App Shell & Core Static Asset Caching (Cache-First + Stale-While-Revalidate)
 * - Map Tile Cache Engine (LRU Bounded Cache for CartoDB, OSM, Esri, Stadia, Google)
 * - Kelantan Overview Tile Pre-warming (Zoom 9-10, ~150KB)
 * - Safe Bypass for Next.js HMR/Dev and Realtime APIs (Supabase, Groq, OpenWeather)
 */

const CACHE_NAME = 'nadi-v4.5.0-cache';
const TILE_CACHE_NAME = 'nadi-map-tiles-v1';

// Maximum map tiles to keep in storage (~10-15MB) to avoid phone quota exhaustion
const MAX_CACHED_TILES = 1000;
const TILE_TRIM_THRESHOLD = 1150;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.jpg',
  '/icon.jpg',
  '/logo.png',
  '/icons/waze.png',
  '/icons/google-maps.svg',
  '/images/malaysia-flag.png'
];

/**
 * Determine if an incoming request URL belongs to a map tile provider
 */
function isMapTileRequest(url) {
  const host = url.hostname;
  const isTileHost = (
    host.endsWith('basemaps.cartocdn.com') ||
    host === 'tile.openstreetmap.org' ||
    host.endsWith('arcgisonline.com') ||
    host.endsWith('stadiamaps.com') ||
    (host.endsWith('google.com') && url.pathname.includes('/vt/'))
  );
  if (!isTileHost) return false;

  return (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.includes('/tile/') ||
    url.pathname.includes('/vt/')
  );
}

/**
 * Background LRU Pruner: Deletes oldest tiles when threshold exceeded
 */
let isPruningTiles = false;
async function pruneOldTiles(tileCache) {
  if (isPruningTiles) return;
  isPruningTiles = true;
  try {
    const keys = await tileCache.keys();
    if (keys.length > TILE_TRIM_THRESHOLD) {
      const deleteCount = keys.length - MAX_CACHED_TILES;
      for (let i = 0; i < deleteCount; i++) {
        await tileCache.delete(keys[i]);
      }
    }
  } catch {
    // Ignore pruning errors silently
  } finally {
    isPruningTiles = false;
  }
}

/**
 * Pre-warm Kelantan overview tiles (Zoom 9 & 10, total ~30 tiles, ~150KB)
 * Gives instant offline / slow data view of the state without loading lag.
 */
async function prewarmKelantanTiles() {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const cartoKey = 'cb1_2fq5_1_bef3664d04037d1f58bc0d33';
    const urls = [];

    // Zoom 9 Kelantan overview (6 tiles)
    for (let x = 400; x <= 401; x++) {
      for (let y = 247; y <= 249; y++) {
        urls.push(`https://a.basemaps.cartocdn.com/rastertiles/dark_all/9/${x}/${y}.png?key=${cartoKey}`);
      }
    }
    // Zoom 10 Kelantan districts (24 tiles)
    for (let x = 800; x <= 803; x++) {
      for (let y = 494; y <= 499; y++) {
        urls.push(`https://a.basemaps.cartocdn.com/rastertiles/dark_all/10/${x}/${y}.png?key=${cartoKey}`);
      }
    }

    for (const tileUrl of urls) {
      const exists = await cache.match(tileUrl);
      if (!exists) {
        try {
          const res = await fetch(tileUrl, { mode: 'cors' });
          if (res && res.status === 200) {
            await cache.put(tileUrl, res);
          }
        } catch {
          // Prewarm failure is non-critical
        }
      }
    }
  } catch {
    // Ignore prewarm initialization errors
  }
}

// 1. Install: Pre-caches core shell assets
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
            // Non-critical asset failure — does not abort install
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// 2. Activate: Cleans up older caches but preserves current tile cache & prewarms Kelantan
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== TILE_CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
      await self.clients.claim();
      // Pre-warm Kelantan overview tiles in the background
      await prewarmKelantanTiles();
    })()
  );
});

// 3. Fetch: Smart routing for Map Tiles, APIs, and Static Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests or unsupported schemes
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // A. DEV / NEXT.JS BYPASS: Never intercept webpack HMR or Next build internals
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('webpack') ||
    url.pathname.includes('hot-update') ||
    url.pathname.includes('react-refresh')
  ) {
    return;
  }

  // B. MAP TILE CACHING: Cache-first with network fallback & LRU storage
  if (isMapTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (tileCache) => {
        const cached = await tileCache.match(event.request);
        if (cached) {
          return cached;
        }

        try {
          const networkRes = await fetch(event.request, { mode: 'cors' });
          if (networkRes && networkRes.status === 200) {
            tileCache.put(event.request, networkRes.clone());
            event.waitUntil(pruneOldTiles(tileCache));
          }
          return networkRes;
        } catch {
          // If offline/dead connection and not cached
          if (cached) return cached;
          return new Response('', { status: 504, statusText: 'Tile Offline' });
        }
      })
    );
    return;
  }

  // C. REALTIME APIS: Supabase, OpenWeather, Groq pass through natively
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('openweathermap.org')
  ) {
    return;
  }

  // D. SAME ORIGIN ONLY for internal application files
  if (url.origin !== self.location.origin) {
    return;
  }

  // E. Internal API routes: Network-first with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // F. Static assets: Cache-first with stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
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
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return caches.match(event.request);
        });
    })
  );
});
