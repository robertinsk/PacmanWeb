// service-worker.js - Versión corregida para Vercel

const CACHE_NAME = 'pacman-cache-v1';

// Obtén la URL base del sitio
const BASE_URL = self.location.origin;

// Define las rutas a cachear
const urlsToCache = [
  `${BASE_URL}/`,
  `${BASE_URL}/index.html`,
  `${BASE_URL}/pacman.js`,
  `${BASE_URL}/modernizr-1.5.min.js`,
  // Añade otros recursos importantes
];

// Evento de instalación - poblar la caché
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalando...');
  
  // Espera hasta que la caché se haya poblado
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Error al cachear recursos:', error);
      })
  );
});

// Evento de activación - limpiar caches antiguas
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activado');
  
  // Elimina cachés antiguas
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Eliminando caché antigua', cacheName);
              return caches.delete(cacheName);
            }
            return Promise.resolve();
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Evento de fetch - estrategia cache-first para recursos estáticos,
// network-first para navegación
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a extensiones de Chrome y otros esquemas no http/https
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  console.log('Service Worker: Fetch', event.request.url);
  
  // Estrategias diferentes según el tipo de solicitud
  if (event.request.mode === 'navigate') {
    // Para navegación, intentamos la red primero, luego la caché
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Si la red falla, recurrimos a la caché
          console.log('Service Worker: La red falló, usando caché para navegación');
          return caches.open(CACHE_NAME)
            .then(cache => {
              return cache.match(event.request) || cache.match(`${BASE_URL}/index.html`);
            });
        })
    );
  } else {
    // Para recursos estáticos (JS, CSS, imágenes), primero caché, luego red
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => {
          return cache.match(event.request)
            .then(response => {
              if (response) {
                // Si está en caché, lo usamos
                console.log('Service Worker: Usando recurso cacheado', event.request.url);
                return response;
              }
              
              // Si no está en caché, lo buscamos en la red
              return fetch(event.request)
                .then(networkResponse => {
                  // Ignorar solicitudes no exitosas
                  if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                  }
                  
                  // Solo guardamos en caché si la respuesta es válida
                  // Clonamos la respuesta porque se consume al guardarla
                  const responseToCache = networkResponse.clone();
                  cache.put(event.request, responseToCache).catch(err => {
                    console.warn('Error al guardar en caché:', err);
                  });
                  
                  return networkResponse;
                })
                .catch(error => {
                  console.error('Error al obtener recurso:', error);
                  return new Response('Recurso no disponible offline');
                });
            });
        })
    );
  }
});

// Manejo de mensajes para forzar skipWaiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Notificar estado de conexión a la página
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients.forEach(client => {
            client.postMessage({
              type: 'OFFLINE_STATUS_CHANGE',
              online: navigator.onLine
            });
          });
        }
      })
    );
  }
});