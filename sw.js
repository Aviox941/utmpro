// ── Pensión UTM Pro — Service Worker ────────────────────────────────────────
// Repo: Aviox941/utmpro → https://aviox941.github.io/utmpro/
// También soporta deploys en raíz (Vercel, etc.) vía scope dinámico.
// Build: 2026-07-17T09:00:00Z
const CACHE_NAME = 'pension-utm-v2.0718.0240';
// BASE se calcula desde el scope real de registro del SW, no hardcodeado.
// En GitHub Pages el scope es '/utmpro/'; en Vercel (raíz) es '/'.
const BASE = new URL(self.registration.scope).pathname;

// Dominios de API/datos EN VIVO: nunca se cachean, siempre van directo a red.
// (Antes también incluía las CDN de librerías estáticas — ese era el bug:
// esas librerías SÍ deben poder servirse desde caché offline.)
const NETWORK_ONLY = [
  'supabase.co',
  'supabase.in',
  'cmfchile.cl',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Librerías estáticas de terceros (versionadas, no cambian de contenido) que
// SÍ se deben poder servir desde caché cuando no hay conexión. Las respuestas
// de estos hosts llegan "opacas" (no-cors) porque se piden con <script src>
// normal, así que no se puede leer su status — se cachean igual, es seguro
// porque son URLs versionadas/inmutables.
const CDN_CACHE_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net'
];

// Archivos del app shell a precachear apenas se instala el SW, para que la
// app funcione offline incluso si el usuario nunca llegó a "tocar" alguno de
// estos recursos en una sesión anterior (antes esto era 100% reactivo).
const PRECACHE_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'export.js',
  BASE + 'styles.css',
  BASE + 'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// ── Instalación: precachear app shell + libs CDN, luego activar ya mismo ────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(PRECACHE_URLS.map(url => {
        const isCdn = CDN_CACHE_HOSTS.some(d => url.includes(d));
        const req = isCdn ? new Request(url, { mode: 'no-cors' }) : url;
        return fetch(req).then(res => cache.put(url, res)).catch(() => {
          // Si el precache falla (p.ej. sin red en el primer install), no
          // rompe la instalación — el fetch handler de abajo lo cacheará
          // reactivamente en cuanto haya red.
        });
      }));
    }).then(() => self.skipWaiting())
  );
});

// ── Activación: borrar SOLO cachés viejas (de versiones anteriores) ─────────
// FIX BUG: antes se borraban TODAS las cachés sin filtrar, incluida la recién
// creada en install() con el mismo CACHE_NAME — como el proyecto sube una
// versión nueva casi en cada sesión, esto vaciaba la caché offline en casi
// cada actualización. Ahora solo se eliminan las de nombre distinto al actual.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Eliminando caché vieja:', k);
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

  // Red directa SIEMPRE para APIs/datos en vivo (Supabase, CMF, fonts)
  const isNetworkOnly = NETWORK_ONLY.some(d => url.hostname.includes(d));
  if (isNetworkOnly) return;

  const isCdnAsset  = CDN_CACHE_HOSTS.some(d => url.hostname.includes(d));
  const isOwnOrigin = url.origin === self.location.origin;

  // Cualquier otro dominio externo no contemplado: red directa, sin cachear.
  if (!isCdnAsset && !isOwnOrigin) return;

  // Solo interceptar requests dentro del scope /utmpro/ (para nuestro origen)
  if (isOwnOrigin && !url.pathname.startsWith(BASE)) return;

  // Network-first: intenta red, cae a caché si no hay conexión
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Nuestro origen: solo cachear respuestas 200 válidas.
        // CDN externo: la respuesta es opaca (status 0, no legible), pero es
        // segura de cachear porque son URLs versionadas/inmutables.
        if (response && (isCdnAsset || (response.status === 200 && isOwnOrigin))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
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
