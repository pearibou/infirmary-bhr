const CACHE='infirmary-shell-v9';
const ASSETS=['./','./index.html','./styles.css?v=0.2.4','./clock.js?v=0.2.4','./app.js?v=0.2.4','./model.js?v=0.2.4','./drive.js?v=0.2.4','./config.js?v=0.2.4','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('infirmary-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok&&ASSETS.some(asset=>new URL(asset,self.registration.scope).href===url.href)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return caches.match('./index.html');return Response.error();}));
});
