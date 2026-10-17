/* Service worker — Le Royal Tavern
   Stratégie : réseau d'abord pour l'API et les commandes, cache pour la coquille
   de l'application (fonctionne partiellement hors ligne). */
const VERSION = 'royal-tavern-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/connexion.html',
  '/compte.html',
  '/suivi.html',
  '/paiement.html',
  '/terminal.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.svg',
  '/img/hero.jpg',
  '/img/poulet-braise.jpg',
  '/img/poisson-braise.jpg',
  '/img/burger.jpg',
  '/img/riz-saute.jpg',
  '/img/poulet-dg.jpg',
  '/img/brochettes.jpg',
  '/img/boissons.jpg',
  '/img/dessert.jpg',
  '/img/ambiance.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API : toujours le réseau en priorité (commandes et données à jour)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: 'Hors ligne — réessayez quand la connexion revient.' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    )));
    return;
  }

  // Pages : réseau d'abord, sinon cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
  );
});
