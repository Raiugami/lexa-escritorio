// Guarda o app para abrir mesmo sem internet. Sempre tenta a versão nova primeiro.
const CACHE='honra-v14';
const BASE=['/app/','/app/index.html','/manifest.webmanifest','/js/config.js','/js/tracking.js','/js/supabase.js','/js/26.supabase.js','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(BASE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // telas do app (/app/painel, /app/clientes, /app/cliente-12): sempre /app/index.html
  if(e.request.mode==='navigate'&&/^\/app(?:\/[a-z][a-z0-9-]*)?\/?$/.test(u.pathname)&&!/\.[a-z0-9]+$/i.test(u.pathname)){
    e.respondWith(fetch('/app/index.html',{cache:'no-cache'}).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('/app/index.html',cp));return r}).catch(()=>caches.match('/app/index.html')));return}
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/app/index.html'))))});
