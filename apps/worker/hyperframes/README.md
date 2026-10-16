# Edit+ — HyperFrames installation (staging branch)

- CLI: `hyperframes@0.8.164` pinned in `apps/worker/package.json`.
- Worker image: Node 22, FFmpeg and system Chromium installed in `apps/worker/Dockerfile`.
- Smoke composition: `apps/worker/hyperframes/smoke/index.html`.
- CI: `.github/workflows/hyperframes-smoke.yml` runs npm install, lint, MP4 render/decode and Docker build.
- Run locally with network access: `cd apps/worker && npm install && ./node_modules/.bin/hyperframes info`.
- Render the smoke: `cd apps/worker/hyperframes/smoke && ../../node_modules/.bin/hyperframes render -o out.mp4`.

**Scope:** The dependency and executable are prepared for installation within the worker image. There is NO automatic switch from the existing production FFmpeg pipeline, NO Railway deployment and NO production render quality claim until the smoke workflow succeeds and deployment is separately verified.

**Editorial presets preserved:** Codie × OMNI V60, Alex Hormozi × OMNI V16, Apple Premium, Leila Hormozi. HyperFrames is only the motion renderer; it does not choose B-roll or transcribe the spoken words on its own.

**Security:** Production source videos must stay in private storage. Do not publish videos as public HyperFrames projects. Use verified spoken transcripts, signed local/proxied media and asset licensing checks.
