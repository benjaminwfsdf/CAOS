// /service-worker.js — ámbito raíz
const VERSION = 'v2.7.65';               // <= bump para forzar actualización
const STATIC_CACHE  = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const API_CACHE     = 'api-cache-v1';

// Precarga (rutas ABSOLUTAS)
const PRECACHE = [
  '/', '/index.html', '/login.html', '/crear_cuenta.html', '/style-caos.css',

  // Alumno
  '/estudiante/estudiante.html',
  // Íconos de alumno (nuevos nombres)
  '/estudiante/icons/icon-alumno-invertido.png',
  '/estudiante/icons/icon-alumno-192.png',
  '/estudiante/icons/icon-alumno-512.png',

  // Panel profesor
  '/panel_profesor/panel_profesor.html',
  '/panel_profesor/panel_profesor_gestion_estudiantes.html',
  '/panel_profesor/estadisticas_CAOS.html',
  '/panel_profesor/cargar_excel_estudiantes.html',
  '/panel_profesor/cierre_ano_escolar.html',
  '/panel_profesor/editar_cursos.html',
  '/panel_profesor/editor_cartas_caos.html',
  '/panel_profesor/generador_qr_estudiantes.html',
  '/panel_profesor/reparto_carta_aleatoria.html',
  '/panel_profesor/reparto_carta_especifica.html',
  '/panel_profesor/validar_canje_CAOS.html',
  '/panel_profesor/prueba%20carga%20con%20retorno.html',

  // Íconos generales (profe)
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estrategias de fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  // Evitar cachear MANIFESTS para que iOS no se quede con el viejo
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Network-first para HTML
  if (isHTML) {
    event.respondWith(
      fetch(req).then(res => {
        caches.open(RUNTIME_CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(async () => (await caches.match(req)) || caches.match('/index.html'))
    );
    return;
  }

  // Cache-first para estáticos
  const isStatic = /\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          caches.open(STATIC_CACHE).then(c => c.put(req, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // SWR para Apps Script
  if (/script\.google\.com/.test(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      const cached = await cache.match(req);
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })());
    return;
  }

  // Resto: network con fallback a cache
  event.respondWith(
    fetch(req).then(res => {
      caches.open(RUNTIME_CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req))
  );
});
