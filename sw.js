// Salt Surf HR Portal — Service Worker
// Bump CACHE_NAME on every meaningful release. This is what triggers the
// `activate` handler to delete old caches, which is the only reliable way to
// invalidate Safari's PWA cache.
const CACHE_NAME = 'saltsurf-hr-v3';

const ASSETS_TO_CACHE = [
  './manifest.json',
  './logo_login.png',
  './logo_sidebar.png',
  './logo_sidebar_white.png',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=Inter:wght@300;400;600;700&display=swap'
];

// Install: cache static assets with cache: 'reload' so we bypass the HTTP cache
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching core assets for', CACHE_NAME);
      return Promise.all(
        ASSETS_TO_CACHE.map(function(url) {
          return fetch(new Request(url, { cache: 'reload' })).then(function(res) {
            if (res && res.ok) return cache.put(url, res);
          }).catch(function() { /* ignore individual failures */ });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches and immediately take control of open pages
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

// Allow the page to ping the SW to take over immediately
self.addEventListener('message', function(event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // NEVER cache Firebase calls — these must always be live
  var url = request.url;
  if (
    url.indexOf('firebaseio.com') !== -1 ||
    url.indexOf('firebasedatabase.app') !== -1 ||
    url.indexOf('firebaseapp.com') !== -1 ||
    url.indexOf('googleapis.com/identitytoolkit') !== -1 ||
    url.indexOf('googleapis.com/securetoken') !== -1
  ) {
    return; // let it pass through, no SW interception
  }

  var isHTML =
    request.mode === 'navigate' ||
    (request.destination === 'document') ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  // HTML / navigation: NETWORK-ONLY, with cached fallback only when truly offline.
  // We don't cache the HTML response itself — that's what was causing Safari
  // to show stale UI even after the site was redeployed.
  if (isHTML) {
    event.respondWith(
      fetch(new Request(request.url, { cache: 'no-store' })).catch(function() {
        return caches.match('./index.html').then(function(cached) {
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Static assets (icons, logos, fonts): cache-first then network
  event.respondWith(
    caches.match(request).then(function(cached) {
      if (cached) return cached;
      return fetch(request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(function() {
        if (request.url.match(/\.(png|jpg|jpeg|svg)$/)) {
          return new Response('', { status: 404, statusText: 'Offline' });
        }
      });
    })
  );
});
