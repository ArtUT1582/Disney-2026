/* Service worker — this page has to open in a queue with no signal.
   Park wifi is unreliable and cellular at rope drop is worse, so everything
   needed to render the itinerary is kept on the device.

   Two strategies, on purpose:
     page   network-first  so a published update lands as soon as there is
                           signal, falling back to the cached copy offline.
     assets cache-first    they are content-hashed or versioned, so a cached
                           copy is never stale for a URL that still matters.

   Bump CACHE when the precache list changes; old caches are deleted on
   activate. */
const CACHE = 'disney2026-v3';

// The shell: without these the page does not render.
const PRECACHE = [
  './',
  './index.html',
  './hero.css',
  './day-metrics.css',
  './day-metrics.js',
  './day-metrics-ui.js',
  './trip-tools.css',
  './trip-tools.js',
  './booking-reminder.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './sections/assets/mk-bg.jpg',
  './sections/assets/ak-bg.jpg',
  './sections/assets/hs-bg.jpg',
  './sections/assets/hhn-bg.jpg',
  './sections/assets/eu-bg.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll fails the whole install if one URL 404s, which would leave the
      // page with no offline copy at all. Add them individually instead.
      return Promise.all(PRECACHE.map(function (url) {
        return c.add(url).catch(function () { /* skip, try again at runtime */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isPage(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').indexOf('text/html') !== -1;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // leave fonts/CDNs alone

  if (isPage(req)) {
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        // Only bank real responses; an opaque or error response cached here
        // would keep serving a broken asset until the cache is bumped.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});

// The page asks for this after it loads, to pull the maps and photos it did
// not need immediately but will want in a park with no signal.
self.addEventListener('message', function (e) {
  if (!e.data || e.data.type !== 'cache-extras' || !Array.isArray(e.data.urls)) return;
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(e.data.urls.map(function (u) {
      return c.match(u).then(function (hit) {
        return hit ? null : c.add(u).catch(function () {});
      });
    }));
  }));
});
