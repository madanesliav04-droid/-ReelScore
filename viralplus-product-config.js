window.VIRAL_SUPABASE_URL = 'https://eiypztjpmxdiuaqxjuqx.supabase.co';
window.VIRAL_SUPABASE_KEY = 'sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C';

(function loadViralStudio(){
  var css=document.createElement('link');
  css.rel='stylesheet';
  css.href='viral-suite.css?v=20261006-studio1';
  document.head.appendChild(css);

  function boot(){
    if(document.getElementById('viralSuiteScript'))return;
    var js=document.createElement('script');
    js.id='viralSuiteScript';
    js.src='viral-suite.js?v=20261006-studio1';
    document.body.appendChild(js);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
