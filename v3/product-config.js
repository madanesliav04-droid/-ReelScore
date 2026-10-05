window.VIRAL_SUPABASE_URL = 'https://eiypztjpmxdiuaqxjuqx.supabase.co';
window.VIRAL_SUPABASE_KEY = 'sb_publishable_Wl8iv037-iZ59iStDPu96A_RMn-US2C';

/* Viral+ mobile-first picker hardening.
   Keep the native file input as the single source of truth on iOS/Android. */
(function () {
  function initMobilePicker() {
    var input = document.getElementById('fileInput');
    var dropzone = document.getElementById('dropzone');
    var plus = document.querySelector('.dropIcon');
    var igPlus = document.querySelector('.igAppIcons span:nth-child(2)');
    if (!input) return;

    input.setAttribute('accept', 'video/*,.mp4,.mov,.webm');

    function openPicker(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        input.value = '';
        input.click();
      } catch (_) {}
    }

    /* Explicit touch/click targets instead of relying on nested <label> behavior,
       which is inconsistent in iOS in transformed/3D containers. */
    if (plus && !plus.dataset.mobilePickerBound) {
      plus.dataset.mobilePickerBound = '1';
      plus.setAttribute('role', 'button');
      plus.setAttribute('aria-label', 'Importer une vidéo');
      plus.style.cursor = 'pointer';
      plus.addEventListener('click', openPicker, true);
    }

    if (igPlus && !igPlus.dataset.mobilePickerBound) {
      igPlus.dataset.mobilePickerBound = '1';
      igPlus.setAttribute('role', 'button');
      igPlus.setAttribute('aria-label', 'Importer une vidéo');
      igPlus.style.cursor = 'pointer';
      igPlus.addEventListener('click', openPicker, true);
    }

    if (dropzone) {
      dropzone.style.touchAction = 'manipulation';
      dropzone.style.webkitTapHighlightColor = 'transparent';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobilePicker, { once: true });
  } else {
    initMobilePicker();
  }
})();
