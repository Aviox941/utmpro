// ── Pensión UTM Pro — Service Worker ────────────────────────────────────────
// Estrategia: Cache-first para assets estáticos, Network-first para Supabase.
// El HTML siempre se busca en red primero para recibir actualizaciones.

const CACHE_NAME = 'pension-utm-v73';

// Assets que se cachean en la instalación
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Dominios que van directo a red (Supabase, CMF, fuentes, CDN)
const NETWORK_ONLY_ORIGINS = [
  'supabase.co',
  'supabase.in',
  'cmfchile.cl',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

// ── Instalación: pre-cachear assets esenciales ───────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activación: limpiar cachés viejas ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia según origen ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Siempre red para dominios externos (Supabase, CMF, CDN, fuentes)
  const isNetworkOnly = NETWORK_ONLY_ORIGINS.some(origin =>
    url.hostname.includes(origin)
  );
  if (isNetworkOnly) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Solo GET se cachea
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. HTML: Network-first — siempre intenta traer la versión más nueva
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. Resto (iconos, manifest): Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
