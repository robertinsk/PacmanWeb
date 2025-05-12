const CACHE_NAME = 'pacman-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/pacman.js',
    '/modernizr-1.5.min.js',
    // Asegúrate de agregar aquí todos los recursos importantes
    // como imágenes, sonidos, CSS, etc. que tu juego necesita
];

// Importación de workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Evento de instalación - poblar la caché
self.addEventListener('install', async (event) => {
  console.log('Service Worker: Instalando...');
  
  // Espera hasta que la caché se haya poblado
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Evento de activación - limpiar caches antiguas
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activado');
  
  // Elimina cachés antiguas
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminando caché antigua', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Habilitar la precarga de navegación si está soportada
if (workbox && workbox.navigationPreload) {
  if (workbox.navigationPreload.isSupported()) {
    workbox.navigationPreload.enable();
  }
}

// Evento de fetch - estrategia cache-first para recursos estáticos,
// network-first para navegación
self.addEventListener('fetch', (event) => {
  console.log('Service Worker: Fetch', event.request.url);
  
  // Estrategias diferentes según el tipo de solicitud
  if (event.request.mode === 'navigate') {
    // Para navegación, intentamos la red primero, luego la caché
    event.respondWith((async () => {
      try {
        // Primero intentamos usar la respuesta precargada si está disponible
        const preloadResp = await event.preloadResponse;
        if (preloadResp) {
          return preloadResp;
        }
        
        // Luego intentamos obtener desde la red
        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        // Si la red falla, recurrimos a la caché
        console.log('Service Worker: La red falló, usando caché para navegación');
        const cache = await caches.open(CACHE_NAME);
        // Intentamos obtener la página específica o caemos en index.html
        const cachedResp = await cache.match(event.request) || await cache.match('/index.html');
        return cachedResp;
      }
    })());
  } else {
    // Para recursos estáticos (JS, CSS, imágenes), primero caché, luego red
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      
      if (cachedResponse) {
        // Si está en caché, lo usamos
        console.log('Service Worker: Usando recurso cacheado', event.request.url);
        return cachedResponse;
      }
      
      // Si no está en caché, lo buscamos en la red
      try {
        const networkResponse = await fetch(event.request);
        
        // Solo guardamos en caché si la respuesta es válida
        if (networkResponse && networkResponse.status === 200) {
          // Clonamos la respuesta porque se consume al guardarla
          const clonedResponse = networkResponse.clone();
          cache.put(event.request, clonedResponse);
        }
        
        return networkResponse;
      } catch (error) {
        console.log('Service Worker: Error al obtener recurso', error);
        // Puedes retornar una respuesta por defecto para ciertos tipos
        // de recursos si tienes preparada una
        return new Response('Recurso no disponible offline');
      }
    })());
  }
});
