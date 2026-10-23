/* Tiny offline cache: network first, fall back to the last good copy so the app opens with no signal. */
const CACHE = 'site-ledger-v3';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const ok = u.origin === location.origin || /(^|\.)(cdnjs\.cloudflare\.com|gstatic\.com|googleapis\.com)$/.test(u.hostname);
  if (!ok || /firestore|identitytoolkit|securetoken|\/__\/auth/.test(u.href)) return;
  e.respondWith(fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(req, c)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
