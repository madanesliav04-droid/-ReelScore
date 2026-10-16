# HyperFrames (Social+ / Edit+) — installation canary

- Base: `socialplus-viral-v9-quality-gates-20261016` (currently deployed worker revision).
- Package: `hyperframes@0.8.164` pinned under `apps/worker/package.json`.
- Node.js 22 and FFmpeg already exist. Docker now installs Chromium libraries and caches a browser at build time.
- `src/hyperframes-renderer.js` provides a **disabled-by-default** CLI adapter for trusted local HTML compositions.
- Existing edits continue through `renderNativeEdit`. Nothing is routed to HyperFrames or exposed to customers.
- Canary CI renders a genuine MP4, verifies with ffprobe, runs regression tests and builds production image.
- Only promote to Railway after CI passes and the output is reviewed. Production remains unchanged until then.

This installs the video render engine. Connecting it to Edit+ styles, captions, timeline/media and export quality needs a separate controlled integration.
