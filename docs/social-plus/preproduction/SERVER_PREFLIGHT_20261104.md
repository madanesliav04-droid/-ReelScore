# Free pre-purchase server preflight — 2026-11-04

No server was purchased or deployed. No production or existing PR branch changed.
This branch changes deployment packaging and test harnesses only; the six artistic
engines and their assets are unchanged.

## Verified evidence

1. A real private 27.166992-second spoken rush passed actual standalone HTTPS owner
   MFA login, browser import, offline preparation, shared Alex rendering, preview,
   browser download with byte/hash equality, full decode and project retrieval after
   restarting the application. Native 512 × 910 preserved, H.264/AAC output
   27.166667 seconds, 2,323,583 bytes. Source and output elementary AAC SHA-256
   hashes match. Transcript remains unreviewed; this is not phonetic certification.
   Elapsed 38.375 seconds; sampled process-group RSS 728,039,424 bytes (~694 MiB).
   Original personal media and full reports remain outside Git/Actions.
2. The exact standalone deployment Dockerfile built successfully on Linux x86-64.
   It includes the verified public Whisper-small model, existing fonts, Remotion
   dependencies, FFmpeg and Chromium. Local built image size: 2,686,331,909 bytes.
3. The complete authenticated UI flow passed **inside that image** with a generated,
   non-personal native 1920 × 1080 spoken fixture. Real offline ASR/planning/render,
   H.264/AAC/native-dimension assertions, preview, browser download hash validation,
   full decode and completed-project persistence after restart all executed.
   Proof: https://github.com/madanesliav04-droid/-ReelScore/actions/runs/41882878154
   Tested source commit: `67b9c6433b54311162b6b5854942c4849e4a2dab`.
4. Numeric proof recovered without rerendering:
   https://github.com/madanesliav04-droid/-ReelScore/actions/runs/41884685002
   Resource mode explicitly skipped the rendering job.

## Measured container resources

The test container used **2 CPU cores**, **8 GiB RAM limit**, no swap allowance
beyond RAM, and **network=none** during application execution. The public package
and weight downloads occurred during fixture/image preparation, not rendering.

- Full UI flow including login/import/preparation/render/playback/download/restart:
  **64.148 seconds**; not the full Actions provisioning/build time.
- Docker-stats sampled RAM maximum: **972,239,667 bytes (~927 MiB)**.
- Sampled mean CPU: **177.55%**; sampled peak **213.31%**; 100% means one core.
- 25 samples; no OOM kill; exit code zero. Sampled working-set figures are not an
  exact kernel memory peak. This is not a benchmark of OVH or every user video.
- The local VFS Docker daemon ran out of disk while copying the image for startup.
  Only the newly created image/cache was removed; existing media and database
  volumes were preserved. The subsequent GitHub container execution passed.
  Production build/temp/video disk peak has not been fully quantified.

## Corrections actually tested

- Both shared Alex and standalone ASR now use the installed Python virtualenv.
  Previously the image configured only the standalone interpreter, leaving shared
  Alex at the system Python without Whisper.
- Consolidated installation layer prevents repeated full media-runtime snapshots
  on VFS builders; exact allowlisted application sources and model hashes retained.
- Test-only arbitrary-UID browser gets a writable temporary HOME/XDG directory.
- The locally generated test HTTPS certificate is explicitly trusted by its SPKI
  pin for Chromium downloads. This fixed a canceled download under the self-signed
  fixture. It is confined to the test harness, not a production TLS exception.
  Browser sandbox bypass is test-only in the disconnected container.
- Failed browser checks retain the generated MP4 and diagnostics; a generated
  export alone never counts as a successful browser download.

## Delivery, costs and limitations

The personal-rush MP4 is available privately in the task workspace. The synthetic
HD result was encrypted before delivery through CI logs; private decryption key
never entered GitHub. The connector currently returns `Transport closed` when
retrieving that large job log; local direct Azure log access is refused by the
workspace proxy. The small read-only recovery job recovered resource figures,
not the HD MP4. No additional video rendering was performed for resource recovery.
No new public/private storage service, Actions artifact or cache was created.

Only standard public-repository GitHub runners used: free compute per
https://docs.github.com/en/billing/concepts/product-billing/github-actions .
Account billing API access remains unavailable; no credit/balance assertion.
No Gemini, Supabase, Railway, Oracle, R2 or paid inference used for these tests.

Synthetic fixture attribution: SIWIS medium French Piper voice, dataset CC-BY 4.0,
https://datashare.is.ed.ac.uk/handle/10283/2353 . Public model/config/card hashes and
pinned upstream revision are in `scripts/ci/synthetic-voice-manifest.json`.

The results support testing a single queued render on an x86 server with 8 GB RAM;
they do not guarantee provider performance, every model or every speech structure.
No OVH machine or public authenticated HTTPS origin exists yet. Physical Safari,
MOV/HEVC import on an iPhone, external TLS/reverse proxy configuration, private
backup/retention operations and multiple simultaneous users remain to validate.
Transcription, contextual infographic text and visual fidelity need human review;
no 100/100, commercialization or word-perfect subtitle claim.
