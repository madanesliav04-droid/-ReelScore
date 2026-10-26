# Alex V16 — targeted final pass, 26 October 2026

No new model, deployment, ref update, production change or media publication.
Original Hormozi modules and the five other model engines remain unchanged.

## Changes and executed checks

- Calibrated the licensed Inter-derived display subset (optical size 32, weight
  650). Existing compositions, transitions, cut rules and caption design remain.
  Foreground-mask IoU of the three historical title samples improves from
  0.7137 to 0.8540. This measures title silhouettes only, not overall fidelity.
  The exact historical typeface has not been recovered.
- Added a source-SHA-bound independent-ASR proposal importer. It never invents
  words or equally divides merged groups. Proposals remain unreviewed and
  explicitly carry `alignmentReviewRequired`; source mismatches are rejected.
  It is a CLI review tool, not an automatically configured second recognizer.
- Two actual native-format raw-rush exports decoded fully: vertical 815 frames,
  107 highlighted ASR units; horizontal 1,359 frames, 153 highlighted ASR units.
  Every sampled active glyph check passed. This checks display against the
  timed plan, not phonetic accuracy. Three horizontal multiword groups remain.
- Both outputs: H.264/AAC, exactly one audio stream. Vertical original AAC is
  bit-identical. Horizontal retains one measured 1.811-second sentence-gap cut;
  exported AAC matches the prepared cut source bit-for-bit.
- Executed: 73 Node tests, 19 Python tests, 20 Chromium browser contract tests;
  all passed. Next production build passed. Contract tests use controlled API
  responses; they do not prove a live authenticated upload-to-render journey.
- Frontend now accepts explicit public Supabase endpoint/key overrides for
  isolated testing. Alex selection requires the explicit public review flag;
  server gates remain separate and disabled by default. No service key is public.

## Remaining validation / blockers

Independent local French Vosk recognition corroborates four of the five flagged
vertical words but conflicts on one. It does not establish the possible negation.
Two vertical timing proposals and one horizontal merged-group split were applied
only to the review exports. All remain unreviewed. Three horizontal groups have
no matching independent lexical sequence and were deliberately left untouched.
Detailed private evidence is kept with the renders, never in this public repo.

Live account/UI E2E was attempted using isolated local Supabase. Registry pulls
failed with HTTP 429 `toomanyrequests: Rate exceeded`; the full-stack attempt also
ran out of image-layer disk space. Only newly pulled test images were removed;
media were preserved, disk space recovered, and test services stopped. A second,
lean attempt also hit the registry limit. No real authenticated E2E is claimed.
A runnable isolated Auth/Storage/DB stack is still needed for that test.

Only two independent complete raw rushes are available. The six-second sample
is an excerpt of the horizontal input (matching decoded audio). The previously
mentioned `SOCIALPLUS_RUSH_BRUT_PARLE_25S.mov` is not accessible in this workspace.
Safari on a physical iPhone has not been tested. Final visual/phonetic approval
is pending; these exports are review drafts, not a commercial-readiness claim.
