window.VIRAL_API_URL = 'https://eiypztjpmxdiuaqxjuqx.supabase.co/functions/v1/viralplus-api';

// V6 product polish is loaded after the existing product code so the live beta can be upgraded safely.
if (location.pathname.includes('/v2/')) {
  window.addEventListener('load', () => {
    if (!document.querySelector('link[data-viral-v6]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'v6.css';
      css.dataset.viralV6 = '1';
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[data-viral-v6]')) {
      const js = document.createElement('script');
      js.src = 'v6-patch.js';
      js.dataset.viralV6 = '1';
      document.body.appendChild(js);
    }
  }, { once: true });
}
