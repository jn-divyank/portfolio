// Network-first: always fresh when online, still opens offline from the last copy.
const CACHE = 'ritual-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './lib.js',
  './icons.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/fonts/inter-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) ?? (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())),
  );
});
