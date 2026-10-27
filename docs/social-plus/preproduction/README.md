# Private Alex V16 beta — activation package

Current step-by-step commands: [DEPLOY_CONNECTED_ALEX.md](DEPLOY_CONNECTED_ALEX.md).
The dedicated Alex image, offline admission mode and guarded schema generator
are now prepared; the read-only remote inventory below remains historical.

Status: **prepared, not deployed; no working remote beta URL yet**.
No production configuration, branch ref, engine or PR merge was changed.
Scope is Alex only. The five other model engines must remain unchanged.

## Verified account inventory (read-only, 26 October 2026)

- Vercel project `socialplus-beta-interface`, ID
  `prj_Wkh4h5DSZo3bPfeEMvX7elWkvCZt`, team
  `team_OHOhV3nnKQdvDgvrBatpGz7O`.
- Existing staging deployment `dpl_BJRFsvno5rfGpiLuJAatrJAbdj6n` is **BLOCKED**.
  Its events list is empty and the connector does not expose a reason. Do not
  call its URL a functioning preview. Check this deployment in the dashboard:
  https://vercel.com/dceo/socialplus-beta-interface/BJRFsvno5rfGpiLuJAatrJAbdj6n
- Existing READY deployment `dpl_GZLDDEKUmqxgJjzPKWj2AYUw6tEz` is marked
  **production**; do not replace, promote or reconfigure it. A READY frontend
  does not prove the Alex renderer is connected.
- Railway `viral-edit`, project `eff635d8-91ad-49f7-b53b-45748b7500f8`, has
  **only production**, environment `c65ec871-c63f-442e-b39c-6abed0823cf0`.
- Its `video-worker` (`df3cab36-c2d4-466b-823c-ec5895685074`) runs an October 19
  commit `bf4dc103bae59931bebe51d6e99b1005c5904949`, not the tested Alex commit.
  No ASR model-path or Alex enable flags are configured and there is no volume.
  It cannot be treated as the tested Alex runtime. Do not update this service.
- A public worker domain is not necessary for the current queue architecture:
  the UI calls authenticated Edge APIs; the worker claims database jobs and
  reads/writes private storage. UI/API/Storage still require valid HTTPS.
- Available connectors expose no Railway remaining-credit/spend-limit evidence.
  Zero additional cost is **not verified**. No Railway activation is authorized
  until that condition is resolved or a separate zero-cost host is available.

- Supabase discovery returns only `eiypztjpmxdiuaqxjuqx`, named `Liav CRM`,
  the existing shared backend. No isolated beta project is present. It must not
  be repurposed or have its users/schema modified for this test.

## Concrete activation sequence

1. Resolve Vercel staging BLOCKED in the existing project without modifying its
   production target. Record the reason and effective free limits.
2. Select a separate worker environment and **separate Auth/DB/Storage project**.
   Do not copy production secrets or share its job queue. Confirm free capacity
   or obtain explicit authorization for a bounded cost before allocating compute.
3. Deploy the reviewed saved code object from PR #58 as a preview only. Do not
   move the PR branch, merge it, or publish any private media in GitHub builds.
4. Use the dedicated `deploy/socialplus-beta/Dockerfile` from the current procedure.
   It includes pinned public Whisper weights, avoiding an extra model volume.
   No private media or paid transcription is involved.
5. Provision the genuine baseline schema before applying current migrations.
   The disposable test used legacy analysis/profile fixtures and replaced an
   incompatible historical job RPC. That workaround is not a validated remote
   provisioning migration. Reconcile this in the separate database first.
6. Configure only PREVIEW Vercel variables from `preview.env.example`, and the
   corresponding isolated worker/Edge values from `runtime.env.example`.
   Only publishable keys may appear in NEXT_PUBLIC_. Set Edge ALLOWED_ORIGIN
   to the exact HTTPS preview origin after deployment; avoid a wildcard.
7. Disable public signup in isolated GoTrue; create one confirmed invited test
   account with no admin privileges. Deliver its password privately or let the
   user choose it through a secure invitation. Local ephemeral test credentials
   are not a remotely usable account and must not be published or reused.
8. One worker replica, one job at a time. Do not activate the other renderers or
   Analysis for this first test. Set `SOCIALPLUS_ALEX_ONLY=true` on the isolated Edge function and worker.
   The prepared server admission gate rejects non-Alex jobs and analyses;
   the normal production runtime remains unchanged. A hidden button alone is insufficient.
9. Apply storage retention and per-user limits with a real scheduled worker or
   equivalent verified control. Existing API advertises 24-hour retention, but
   no automatic permanent-object deletion is wired in this branch. Local render
   workdirs are deleted after jobs; this is distinct from stored source/export
   deletion. Never promise cleanup until a nonpersonal fixture has expired and
   been verified deleted. Retain the three owner-approved review MP4s separately.
10. Run the acceptance checks below against that isolated HTTPS origin. Only
    after actual success provide the URL and test account to the owner.

## Acceptance gates and existing evidence

| Control | Local evidence | Before remote beta |
|---|---|---|
| Password session and no public signup | Real GoTrue login passed | Configure invitation-only registration and expiry |
| Owner isolation | Two accounts; wrong-owner job/export 404, anonymous 401 | Repeat on remote isolated Auth/DB/Storage |
| Video import | Actual resumable MOV upload passed | Verify Safari picker, large upload, interruption/retry |
| Alex selection/render | Real worker, native 512×910 export passed | Confirm enable flags and correct deployed commit |
| Progress | Actual job stages/frame counts; heartbeat implemented | Observe queued→transcribing→rendering→completed remotely |
| Errors | Targeted browser recovery/review regressions passed | Test bad file, expired login, failed render; no false completion |
| Private playback/download | Signed 600-second URL; Range 206; actual download-button click | Repeat on Safari and verify expiry/private bucket |
| Project data | One source/project/timeline/export/job persisted in local DB | Verify durable remote DB and reopening after restart |
| Original audio | Full 815-frame decode; original AAC identical | Probe downloaded remote MP4 and listen on iPhone |
| Storage limits/retention | 200 MB upload preflight; temporary workdir cleanup | Implement and test real stored-object cleanup and quotas |
| Costs | No new remote services activated | Verify allowance, limits and stop conditions before activation |
| Physical iPhone | Not executed | Owner must validate Safari playback, Save to Files and visuals |

The three existing MP4 hashes remain unchanged. Five unresolved speech excerpts
are kept privately with the deliveries. Alex remains explicitly marked as a
review draft until human phonetic/visual approval. Do not merge PR #58.
