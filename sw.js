const CACHE = 'task-os-20260411-214406';
const STATIC = [
  './manifest.json',
  './manifest-givelink.json',
  './icon.svg',
  './icon-gl.svg'
];
const HTML = [
  './',
  './index.html',
  './givelink.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([...HTML, ...STATIC]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isLocal = url.origin === self.location.origin;

  // Static assets — cache first
  if (isLocal && STATIC.some(s => url.pathname.endsWith(s.replace('./', '/')))) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // HTML pages — network first, fall back to cache
  if (isLocal && (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html'))) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // External requests (Claude API, etc.) — network only
  if (!isLocal) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
