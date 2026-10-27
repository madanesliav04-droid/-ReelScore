# Alex V16 — real isolated account validation

## Executed, no deployed environment

Docker Hub's official `supabase/gotrue:v2.197.0`,
`postgrest/postgrest:v14.18`, and `supabase/storage-api:v1.81.0` images
were accessible; the previous ECR HTTP 429 is no longer a blocker for this test.
Postgres 17 ran on an internal test network. A loopback-only reverse proxy
forwarded real Auth, REST, Storage/TUS and the existing Deno Edge handler.
No mock authentication, database, storage or renderer was used in this live test.

The isolated schema used the checked-in core/model/queue migrations. Two legacy
analysis/profile table definitions were supplied as test prerequisites because
the historical baseline definitions are absent. The core-to-queue migration
sequence also required dropping the older incompatible job RPC before applying
its replacement in this disposable database. No remote schema was changed.
This test does not validate provisioning from a pristine production schema,
legacy analysis/credit behavior, production versions, or long-term storage.

## Minimal application fixes

- Resumable uploads now follow the configured self-hosted Supabase origin;
  hosted projects retain their existing dedicated Storage domain.
- Owned Supabase exports return an additional short-lived attachment URL.
  The existing result panel exposes its real download action. Existing playback
  links remain. R2 still uses its previous signed playback link; no new R2
  attachment behavior is claimed or enabled.
- Added a real-account UI integration runner and endpoint regression tests.
  Credentials and all media/results must remain outside the repository.

## Actual journey and evidence

A real GoTrue password session logged into the existing UI at a 390×844
viewport, uploaded a complete native vertical raw MOV using TUS, selected
Alex Hormozi, submitted a real job, ran the actual worker with offline Whisper
and Python/FFmpeg Alex rendering, decoded the inline MP4 and downloaded it.
No master video was supplied to the renderer. Render time: 36.010 seconds in
this test environment, not a performance guarantee.

The downloaded MP4 has 815 decoded frames, 512×910 native dimensions,
27.166667 seconds, H.264 video and exactly one AAC audio stream.
The original AAC bitstream is identical. Signed Range GET returned 206 with
exactly the requested 1,024 bytes. A real click on the attachment link downloaded
2,323,583 bytes, SHA-256
`87134f3fa88785c58b0ec54be27132f4ddf926c43010b4391281385dc3cd7d39`.
A real owned job checkpoint restored through the UI and the review warning was
visible. This checkpoint test is not a claim about a complete Projects browser.

The database recorded one source, one render, one project, one timeline, one
export and one completed job; zero failed jobs. Two actual accounts verified:
no session → 401, another user's job/export → 404. A signed download URL remains
a short-lived bearer capability; it must not be shared publicly.

Ten targeted browser/upload regressions passed after the final changes. Next
build passed. The unchanged 73 worker and 19 Python tests were not rerun.
The live tests and the stubbed regression tests are separate evidence.

## Reproduce the live journey

Start a genuine isolated Auth/Storage/REST/Edge/worker stack and the UI with
local endpoint/public-key overrides plus the separate Alex review gates.
Never set a service-role key in `NEXT_PUBLIC_` variables. Then run:

```sh
SOCIALPLUS_TEST_URL=http://127.0.0.1:3211 \
SOCIALPLUS_TEST_CREDENTIALS=/private/test-credentials.json \
SOCIALPLUS_TEST_RUSH=/private/raw.mov \
SOCIALPLUS_TEST_OUTPUT=/private/alex-live-results \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
node viral-studio/scripts/test-alex-live-ui.mjs
```

The credentials file contains `email` and `password` for an actual confirmed
local account. Outputs must stay outside this repository. The runner blocks
external browser requests and will not run against production. The complete
live run was executed with the same UI actions in the private test harness;
the committed parameterized runner was syntax-checked, not rerun to avoid
another identical render.

## Still unvalidated

- Physical Safari/iPhone: no attached device. Chromium mobile viewport is not
  Safari, and no physical-phone success is claimed. WebKit binary unavailable.
- Exact speech at the two disputed vertical passages and three horizontal merged
  groups: local contextual ASR remains contradictory or returns zero-length
  word boundaries. No guessed text/timestamps were applied.
- The two previously corrected private review exports remain available unchanged.
  The live UI test generated a separate automatic-transcription review export;
  independent timing proposals are a review CLI, not an automatic certification
  stage in the worker.
- The third independent raw rush is deferred to the private beta, not a blocker
  to this technical integration check.

No engine, composition, other model, PR ref or production deployment changed.
Alex remains a review draft until manual speech and visual approval.
