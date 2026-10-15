'use strict';
// No API, admin or event-data cache: all live information stays online.
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const home = new URL('./', self.registration.scope);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
      url.origin !== home.origin || ![home.pathname, home.pathname + 'index.html'].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balèti Sauvage</title><style>body{font:18px system-ui;max-width:36rem;margin:12vh auto;padding:24px;background:#f4f0e7;color:#17130d}button{font:inherit;padding:12px}</style><h1>Balèti Sauvage Montpellier</h1><p>Une connexion Internet est nécessaire pour afficher les prochains rendez-vous et les galeries à jour.</p><p>Reconnecte ton appareil puis réessaie.</p><form><button>Réessayer</button></form></html>',
    {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}}
  )));
});
