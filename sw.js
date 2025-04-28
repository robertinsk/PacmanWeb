
const CACHE_NAME = 'vl';
const urlsToCache = [
    '/',
    '/index.html',
    '/pacman.js',
    '/modernizr-1.5.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});
