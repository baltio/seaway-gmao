/* Service worker Seaway GMAO : rend l'application disponible hors ligne.
   - Page de l'application : réseau d'abord (toujours la dernière version en
     ligne), copie en cache pour le hors ligne.
   - Icônes et manifeste : cache d'abord.
   - Polices Google : copie en cache pour garder l'apparence hors ligne.
   - Tout le reste (Google Drive, connexion Google) : jamais mis en cache.
   Les DONNÉES ne passent pas par ici : elles restent dans le navigateur
   (IndexedDB) et dans l'emplacement de synchronisation.
   20261024-1706-a081c4ca9367 est remplacé à chaque déploiement (tools/preparer-deploiement.ps1),
   ce qui déclenche la mise à jour de l'application sur les appareils. */
const VERSION = '20261024-1706-a081c4ca9367';
const CACHE = 'seaway-gmao-' + VERSION;
const FONTS = 'seaway-gmao-polices';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];

self.addEventListener('install', event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('seaway-gmao-') && k!==CACHE && k!==FONTS).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event=>{
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com'){
    event.respondWith(caches.open(FONTS).then(async c=>{
      const hit = await c.match(req);
      const net = fetch(req).then(r=>{ if(r.ok || r.type==='opaque') c.put(req, r.clone()); return r; }).catch(()=>hit);
      return hit || net;
    }));
    return;
  }
  if(url.origin !== self.location.origin) return; // Google Drive, connexion : réseau direct
  if(req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/seaway-config.json')){
    event.respondWith(fetch(req).then(r=>{
      if(r.ok){ const copy = r.clone(); caches.open(CACHE).then(c=>c.put(req.mode==='navigate' ? './index.html' : req, copy)); }
      return r;
    }).catch(()=>caches.match(req.mode==='navigate' ? './index.html' : req)));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit || fetch(req)));
});
/* clic sur la notification des rappels : ouvrir l'application sur « Rappels & agenda » */
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  const target = new URL('./#/rappels', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
    const c = list[0];
    if(c) return c.focus().then(()=>c.navigate ? c.navigate(target) : null);
    return self.clients.openWindow(target);
  }));
});
