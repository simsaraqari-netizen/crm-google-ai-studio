// Simple Service Worker for PWA installation
const CACHE_NAME = 'simsar-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(async (error) => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;
      
      // If the request isn't in cache and network fails, return a synthetic error response
      // to prevent "Failed to convert value to 'Response'" error
      return new Response(JSON.stringify({ error: 'Network error', message: error.message }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );
});
