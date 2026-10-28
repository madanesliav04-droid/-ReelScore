// Never cache account pages, API responses, source videos, MP4s or transcripts.
// The PWA is installable; video processing requires a connection to its server.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Social+ — Connexion nécessaire</title></head><body><main><h1>Social+</h1><p>Connexion nécessaire pour retrouver vos projets et traiter vos vidéos.</p><p>Votre montage peut continuer sur le serveur. Reconnectez-vous pour vérifier son état.</p><a href="/">Réessayer</a></main></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'"}})));
});
