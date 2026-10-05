(() => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  // Safari can report support for an explicit AVC/AAC MediaRecorder profile
  // and still produce unstable fragmented MP4s. Prefer Safari's generic MP4 profile.
  if (window.MediaRecorder && typeof MediaRecorder.isTypeSupported === 'function') {
    const nativeIsTypeSupported = MediaRecorder.isTypeSupported.bind(MediaRecorder);
    try {
      MediaRecorder.isTypeSupported = (type) => {
        if (/^video\/mp4;\s*codecs=/i.test(String(type || ''))) return false;
        return nativeIsTypeSupported(type);
      };
    } catch (_) {}
  }

  const nativePlay = HTMLMediaElement.prototype.play;
  const retrying = new WeakSet();

  function waitForMedia(el, timeout = 900) {
    if (el.readyState >= 3) return Promise.resolve();
    return Promise.race([
      new Promise((resolve) => {
        const done = () => { cleanup(); resolve(); };
        const cleanup = () => {
          el.removeEventListener('canplay', done);
          el.removeEventListener('loadeddata', done);
        };
        el.addEventListener('canplay', done, { once: true });
        el.addEventListener('loadeddata', done, { once: true });
      }),
      new Promise((resolve) => setTimeout(resolve, timeout))
    ]);
  }

  async function seekSafely(el, target) {
    const t = Math.max(0, Number(target) || 0);
    try {
      if (typeof el.fastSeek === 'function') el.fastSeek(t);
      else el.currentTime = t;
    } catch (_) {
      try { el.currentTime = t; } catch (_) {}
    }
    await waitForMedia(el, 650);
  }

  HTMLMediaElement.prototype.play = function (...args) {
    const el = this;
    const first = nativePlay.apply(el, args);
    if (!first || typeof first.catch !== 'function') return first;

    return first.catch(async (err) => {
      const msg = `${err?.name || ''} ${err?.message || ''}`.toLowerCase();
      if (!/decod|media|source|support|operation/.test(msg) || retrying.has(el)) throw err;

      retrying.add(el);
      const target = Number.isFinite(el.currentTime) ? el.currentTime : 0;
      try {
        // Retry 1: nudge a few frames backwards to the previous decodable keyframe.
        el.pause();
        await new Promise(r => setTimeout(r, 70));
        await seekSafely(el, Math.max(0, target - 0.08));
        try {
          return await nativePlay.call(el);
        } catch (_) {
          // Retry 2: rebuild the decoder, preserve the requested position, then play again.
          el.pause();
          const src = el.currentSrc || el.src;
          if (!src) throw err;
          el.load();
          await waitForMedia(el, 1100);
          await seekSafely(el, Math.max(0, target - 0.14));
          return await nativePlay.call(el);
        }
      } finally {
        retrying.delete(el);
      }
    });
  };
})();
