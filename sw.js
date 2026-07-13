// ── Pensión UTM Pro — Service Worker ────────────────────────────────────────
// Repo: Aviox941/utmpro → https://aviox941.github.io/utmpro/
// También soporta deploys en raíz (Vercel, etc.) vía scope dinámico.
// Build: 2026-07-09T10:13:00Z
const CACHE_NAME = 'pension-utm-v2.0713.0407';
// BASE se calcula desde el scope real de registro del SW, no hardcodeado.
// En GitHub Pages el scope es '/utmpro/'; en Vercel (raíz) es '/'.
const BASE = new URL(self.registration.scope).pathname;

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

// ── Activación: limpiar TODAS las cachés y tomar control ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(k => {
          console.log('[SW] Eliminando caché:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Network-first para todo, caché solo como fallback offline ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // Red directa para APIs y CDNs externos
  const isExternal = NETWORK_ONLY.some(d => url.hostname.includes(d));
  if (isExternal) return;

  // Solo interceptar requests dentro del scope /utmpro/
  if (!url.pathname.startsWith(BASE) && url.origin === self.location.origin) return;

  // Network-first: intenta red, cae a caché si no hay conexión
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Solo cachear respuestas válidas de nuestro origen
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red: intentar caché como fallback
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Si no hay caché y es navegación, devolver index.html cacheado
          if (event.request.mode === 'navigate') {
            return caches.match(BASE + 'index.html');
          }
        });
      })
  );
});

// ── Mensaje SKIP_WAITING: activar nueva versión inmediatamente ───────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
