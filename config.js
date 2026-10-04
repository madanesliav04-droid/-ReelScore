window.VIRAL_API_URL = 'https://eiypztjpmxdiuaqxjuqx.supabase.co/functions/v1/viralplus-api';

// Viral+ progressive product polish. V6 handles auth/social interaction; V6.1 cleans hierarchy and scroll narrative.
if (location.pathname.includes('/v2/')) {
  window.addEventListener('load', () => {
    const addCss = (href, key) => {
      if (document.querySelector(`link[data-${key}]`)) return;
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = href;
      css.setAttribute(`data-${key}`, '1');
      document.head.appendChild(css);
    };
    const addJs = (src, key, onload) => {
      if (document.querySelector(`script[data-${key}]`)) { onload?.(); return; }
      const js = document.createElement('script');
      js.src = src;
      js.setAttribute(`data-${key}`, '1');
      if (onload) js.onload = onload;
      document.body.appendChild(js);
    };

    addCss('v6.css', 'viral-v6');
    addCss('v6-1.css', 'viral-v61');
    addJs('v6-patch.js', 'viral-v6', () => addJs('v6-1-patch.js', 'viral-v61'));
  }, { once: true });
}
