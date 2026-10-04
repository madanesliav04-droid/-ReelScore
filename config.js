window.VIRAL_API_URL = 'https://eiypztjpmxdiuaqxjuqx.supabase.co/functions/v1/viralplus-api';
if (location.pathname.indexOf('/v2/') !== -1) {
  window.addEventListener('load', function () {
    function addCss(href, key) {
      if (document.querySelector('link[data-' + key + ']')) return;
      var css = document.createElement('link'); css.rel='stylesheet'; css.href=href; css.setAttribute('data-' + key,'1'); document.head.appendChild(css);
    }
    function addJs(src, key, next) {
      if (document.querySelector('script[data-' + key + ']')) { if (next) next(); return; }
      var js=document.createElement('script'); js.src=src; js.setAttribute('data-' + key,'1'); if(next) js.onload=next; document.body.appendChild(js);
    }
    addCss('v6.css','viral-v6');
    addCss('v6-1.css','viral-v61');
    addJs('v6-patch.js','viral-v6',function(){ addJs('v6-1-patch.js','viral-v61'); });
  }, {once:true});
}