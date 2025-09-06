// /service-worker.js — ámbito raíz
const VERSION = 'v2.1.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// Precarga páginas clave para que abran offline.
// Usa rutas ABSOLUTAS. Si tienes archivos con espacios en el nombre,
// aquí deben ir URL-encoded (ej: espacio -> %20)
const PRECACHE = [
  '/',                    // fallback
  '/index.html',
  '/login.html',
  '/crear_cuenta.html',
  '/style-caos.css',

  // Alumno
  '/estudiante/estudiante.html',

  // Panel profesor (lista de tu screenshot)
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
  // Archivo con espacios (recomendado renombrar a sin espacios)
  '/panel_profesor/prueba%20carga%20con%20retorno.html',

  // Íconos
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
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// HTML -> network-first; Estáticos -> cache-first; Resto -> network con fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match('/index.html');
      })
    );
    return;
  }

  const url = new URL(req.url);
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

  event.respondWith(
    fetch(req).then(res => {
      caches.open(RUNTIME_CACHE).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req))
  );
});
