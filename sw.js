/* Offline itinerary: exact versioned URLs, per-page navigation keys and acknowledged readiness. */
const CACHE = 'disney2026-v23';
const PRECACHE = ['./', './index.html', './install-guide.html', './manifest.json', './boutique.ics', './cinderellas-royal-table.ics'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(PRECACHE.map(url => cache.add(new Request(url, {cache:'reload'})).catch(() => false)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('disney2026-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const page = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = page ? new URL(url.pathname, self.location.origin).href : request;
    if (!page) { const hit = await cache.match(key); if (hit) return hit; }
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(key, response.clone());
      return response;
    } catch (error) {
      return await cache.match(key) || new Response('This file was not saved offline. Reconnect and check offline status.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  }));
});
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'prepare-offline' || !Array.isArray(data.core) || !Array.isArray(data.extras) || !event.ports[0]) return;
  const scope = new URL(self.registration.scope);
  function allowed(value) {
    try { const url = new URL(value); return url.origin === scope.origin && url.pathname.startsWith(scope.pathname); }
    catch (error) { return false; }
  }
  if (data.core.length + data.extras.length > 500 || !data.core.concat(data.extras).every(allowed)) {
    event.ports[0].postMessage({type:'offline-result', ready:false, failedCore:['Invalid asset list']}); return;
  }
  event.waitUntil(caches.open(CACHE).then(async cache => {
    async function save(url) {
      try {
        if (await cache.match(url)) return true;
        const response = await fetch(url, {cache:'reload'});
        if (!response.ok || response.type !== 'basic') return false;
        await cache.put(url, response); return true;
      } catch (error) { return false; }
    }
    const coreResults = await Promise.all(data.core.map(save));
    const extraResults = await Promise.all(data.extras.map(save));
    const failedCore = data.core.filter((_,i) => !coreResults[i]);
    event.ports[0].postMessage({type:'offline-result', ready:failedCore.length===0, failedCore,
      failedExtras:extraResults.filter(ok => !ok).length, savedAt:new Date().toISOString(), version:CACHE});
  }).catch(() => event.ports[0].postMessage({type:'offline-result', ready:false, failedCore:['Storage unavailable']})));
});
