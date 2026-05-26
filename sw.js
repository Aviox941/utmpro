// ── Pensión UTM Pro — Service Worker ────────────────────────────────────────
const CACHE_NAME = 'pension-utm-v73';

// Dominios que van directo a red (nunca cachear)
const NETWORK_ONLY = [
  'supabase.co',
  'supabase.in',
  'cmfchile.cl',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

// ── Instalación: no pre-cachear nada, skipWaiting inmediato ─────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── Activación: limpiar cachés viejas y tomar control ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Network-first para todo, caché solo como fallback ─────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // Red directa para APIs y CDNs externos
  const isExternal = NETWORK_ONLY.some(d => url.hostname.includes(d));
  if (isExternal) return;

  // Para todo lo demás: Network-first, caché como fallback offline
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Solo cachear respuestas válidas
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red: intentar caché
        return caches.match(event.request);
      })
  );
});
