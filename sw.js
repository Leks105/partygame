/* =========================================================
   Service worker: «Правда или Действие 18+»
   Кэшируем только локальные статические файлы приложения.
   API DeepSeek и любые не-GET запросы не перехватываем.
   ========================================================= */

'use strict';

const CACHE_NAME = 'pravda-ili-deystvie-v5';
const CACHE_TIMEOUT_MS = 3000;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

function timeout(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), ms);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Строго игнорируем всё, что не является GET-запросом.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Строго не перехватываем DeepSeek API.
  if (url.hostname === 'api.deepseek.com' || url.hostname.endsWith('.deepseek.com')) return;

  // Кэшируем только локальные файлы приложения.
  if (url.origin !== self.location.origin) return;

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
      }
      return response;
    })
    .catch(() => {});

  event.respondWith(
    (async () => {
      const networkResponse = await Promise.race([
        fetchPromise,
        timeout(CACHE_TIMEOUT_MS)
      ]);

      if (networkResponse) return networkResponse;

      const cached = await caches.match(request);
      if (cached) return cached;

      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }

      return Response.error();
    })()
  );
});
