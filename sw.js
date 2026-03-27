// Salt Surf HR Portal — Service Worker v1.0
const CACHE_NAME = 'saltsurf-hr-v1';
const ASSETS_TO_CACHE = [
  './',
  './SaltSurf_HR_Portal.html',
  './manifest.json',
  './logo_login.png',
  './logo_sidebar.png',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=Inter:wght@300;400;600;700&display=swap'
];

// Install: cache all core assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // HTML pages: try network first, fall back to cache
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(request).then(function(cached) {
          return cached || caches.match('./SaltSurf_HR_Portal.html');
        });
      })
    );
    return;
  }

  // All other assets: cache-first, then network
  event.respondWith(
    caches.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        // Cache successful responses for future use
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback for images
        if (request.url.match(/\.(png|jpg|jpeg|svg)$/)) {
          return new Response('', { status: 404, statusText: 'Offline' });
        }
      });
    })
  );
});
