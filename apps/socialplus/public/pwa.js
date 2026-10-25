// Installation metadata only; processing stays on the authenticated cloud server.
if('serviceWorker' in navigator&&window.isSecureContext){
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{
  console.warn('Social+ : installation hors ligne indisponible ; l’application en ligne reste accessible.');
 }));
}
