// ============================================================
// sw.js — Service Worker · Pensión UTM Liquidación Pro
// Estrategia: Cache First para assets estáticos,
//             Network First para API CMF/Supabase
// ============================================================

const CACHE_NAME = 'pension-utm-v1';
const CACHE_STATIC = 'pension-utm-static-v1';
const CACHE_FONTS  = 'pension-utm-fonts-v1';

// Assets que se pre-cachean al instalar el SW
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Dominios externos que se cachean con estrategia Cache First (sin expiración corta)
const CACHEABLE_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

// Dominios que SIEMPRE van a red (APIs de datos)
const NETWORK_ONLY_ORIGINS = [
  'api.cmfchile.cl',
  'supabase.co',
  'supabase.io'
];

// ─── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando…');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en pre-cache:', err))
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activando…');
  const validCaches = [CACHE_NAME, CACHE_STATIC, CACHE_FONTS];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => {
            console.log('[SW] Eliminando caché obsoleto:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // APIs de datos → siempre red, sin cachear
  if (NETWORK_ONLY_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(fetch(request));
    return;
  }

  // Fuentes y CDNs externos → Cache First
  if (CACHEABLE_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  // Assets locales (index, manifest, iconos) → Cache First con fallback a red
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Resto → red directa
  event.respondWith(fetch(request));
});

// ─── ESTRATEGIAS ──────────────────────────────────────────

/**
 * Cache First: devuelve desde caché si existe,
 * si no va a red y guarda la respuesta.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Sin red y sin caché para:', request.url);
    // Fallback offline: devuelve index.html para navegación
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }
    throw err;
  }
}

// ─── MENSAJES DESDE LA APP ────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    console.log('[SW] Caché limpiado por solicitud de la app');
  }
});
