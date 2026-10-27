# Connected preproduction verification — 2026-10-27

No deployment, paid service, production change or merge was performed. PR #58
remains open/draft at d2eccb4299c35f2b0d3b9b2394871c86af56309e.
This branch preserves the existing recovered beta/ARM64 corrections. No artistic
engine or model asset was changed in this iteration.

## Corrections

- Job API proxy now preserves query parameters, validates path segments and bearer
  syntax, disables caching, refuses upstream redirects, times out after 13 seconds,
  returns an explicit 503 on transport failure, preserves Retry-After and handles
  empty 204/205/304 responses. Tokens and upstream exceptions are never logged.
- Vercel Preview builds now refuse missing isolated Supabase settings or the known
  production backend, even when the Alex-only flag was accidentally omitted.
- `viral-studio/vercel.json` specifies Next.js/build/install/output and disables
  automatic Git deployments. Root Directory must be set to `viral-studio` in the
  provider settings; it is not a vercel.json field.

## Executed checks

- Worker: `npm test` — 77 passed, 0 failed.
- Existing browser suite plus first four proxy tests: 26 passed, 1 conditional
  beta test skipped. Chromium on Linux with 320/375px viewport tests, not Safari.
- Final proxy suite: 5 passed, including actual HTTP requests to Next.js proving
  anonymous denial (401) and unknown function denial (404). Upstream success,
  failure, query forwarding and redirects policy are dependency-injected tests.
- Explicit beta selection test: first failed because the review-enable flag was
  missing, correctly leaving Alex disabled. With all documented flags supplied,
  rerun passed. Browser session/API responses in that test are mocked, not proof
  of hosted authentication or a cloud render.
- Next.js 16.3.8 production build and TypeScript passed. A Preview/Alex-only build
  also passed using explicit local-test settings, not deployed credentials.
- Real private 27.166992-second raw rush: localhost authenticated upload -> fresh
  offline Whisper -> shared Alex pipeline -> MP4 -> Range preview -> download.
  No mounted master was used. Upload 202; anonymous 401; early preview 409;
  completed preview 206; download 200; source/download SHA checks passed;
  progress monotonic. Output: 2,323,583 bytes, 512x910 H.264/AAC, 27.166667 seconds.
- Full FFmpeg decode passed. Python frame/audio check passed: 815 frames,
  107/107 planned words highlighted, no zero-frame intervals or merged groups;
  maximum quantization 0.028667s. One audio track; original AAC bitstream identical.
  No cuts were justified by measured inter-sentence gaps on this rush.
- Five transcription issues remain: draft/review required, no phonetic certificate
  or claim of final artistic validation. No master comparison performed this turn.
- Real video signal extraction succeeded on the same rush (duration, dimensions,
  audio and measured signals). The editorial analysis was NOT executed: `viral.js`
  calls Gemini for transcription/multimodal interpretation; no approved key/cost
  path is configured. The offline Alex-only runtime deliberately rejects analysis.

Private media, screenshots, words and full reports remain outside Git under
`/workspace/socialplus-private-renders/connected-preproduction-20261027/`.
They were not uploaded as public artifacts. The MP4 is named
`Alex_V16_rush_brut_a_verifier.mp4`; integrity proof is `upload-e2e.json`.

## Provider inspection and activation blockers

Read-only Vercel inspection of existing project
`prj_Wkh4h5DSZo3bPfeEMvX7elWkvCZt` (`socialplus-beta-interface`): framework null,
no environment variables returned, SSO protection enabled for all except custom
domains. Last deployment `dpl_BJRFsvno5rfGpiLuJAatrJAbdj6n` reports BLOCKED, target
staging; deployment events are empty and metadata contains no error reason.
Do not infer a billing/permissions root cause from this status alone.
The existing domain is NOT a verified connected preview for this branch.

Before an HTTPS preview is activated:

1. Validate a genuinely isolated backend, private Storage bucket, Auth account,
   database ownership policies, Edge routes and running Alex worker using the
   existing `deploy/socialplus-beta/verify-backend.mjs` and procedure in
   `DEPLOY_CONNECTED_ALEX.md`. Their inputs are currently unavailable here.
2. Confirm actual zero-extra-cost capacity before creating/activating anything.
   Vercel alone cannot persist media or run this long Python/FFmpeg render.
3. Set Preview-only variables: isolated `NEXT_PUBLIC_SUPABASE_URL`, isolated public
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SOCIALPLUS_ALEX_ONLY=true`,
   `NEXT_PUBLIC_ALEX_V16_REVIEW_ENABLED=true`. Never place service-role/ASR/provider
   secrets in NEXT_PUBLIC variables. Test fixture settings above are not usable
   cloud credentials. Public signup should stay disabled, testers invited.
4. Set Root Directory `viral-studio`, framework `nextjs` on the isolated Vercel
   project, then create a manual Preview pinned to the reviewed commit. Do not
   promote or repoint production aliases. Git automatic deployments remain off.
5. Confirm Vercel protection/account access, then perform real account login,
   import, render, MP4 playback/download/reopen on Safari iPhone. No physical
   iPhone or remote end-to-end validation was executed in this iteration.

No verified HTTPS URL or hosted test account can be supplied until these blockers
are resolved. No fake analysis/MP4 is substituted. Existing six models remain
preserved; their independent cloud readiness is not certified by these checks.
