# Recovery release — 2026-10-07

Scope: stabilize existing web client before native migration. This is NOT acceptance of the complete Viral Studio product.

## Changes

- Account-scoped active-job recovery, cleared only after successful output retrieval.
- Sequential polling with backoff after network errors; no overlapping poll requests.
- Explicit handling of cancelled and missing jobs; retained job pointer after expired session.
- Shared resumable upload implementation for Viral+/Edit+/Clip+.
- Account-scoped upload fingerprint; resumed media registration uses the original object path.
- Fresh authorization for every upload request, concurrent upload lock, early empty/type/size validation.
- Source preview object URLs released after replacement.
- Browser contract tests added to CI using pinned dependencies and npm ci.

## Observed production baseline

- Repository branches and Railway services match the supplied existing infrastructure.
- Supabase video bucket is private, 524288000-byte limit, MP4/MOV/WebM MIME allowlist.
- Worker-only RPCs deny anon and authenticated access. User job creation requires authenticated ownership.
- Existing processing records: 24 completed analyses, 68 completed edits, 20 completed clip jobs; these are historical database states, not new end-to-end quality verification.
- Production dashboard presents email/password login. No signed-in test session was available during the audit.

## Verification boundary

The Playwright suite uses stubbed backend responses to exercise failure and recovery cases. It does not establish real Gemini analysis, FFmpeg output quality, YouTube import reliability, or native mobile behavior.

Still required before product acceptance: authenticated production upload and output inspection, diverse Viral+ inputs, eight-style edit comparison, 5/10/20 clips and five public YouTube URLs, native iOS/Android application and device tests, library and notifications, store readiness.
