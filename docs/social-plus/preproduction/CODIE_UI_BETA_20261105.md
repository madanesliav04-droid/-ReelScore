# Codie partial beta: real interface connection — 2026-11-05

Explicit opt-in: `SOCIALPLUS_CODIE_V60_PARTIAL_BETA=true`, default false.
Catalog exposes "Codie × OMNI — bêta partielle" and missing insert/SFX warnings.
Full-model restoration and release approval remain false. No artistic engine or
other five model implementations changed; locked V28 integrity check passes.

The original-animation CLI port is now a reusable render function. The server
uses it directly, not the legacy component preview. Submitted corrected words
are preserved and bound to the actual uploaded source hash on the server.
Reviewed graphic directions are honored: exact source word, kind, timing and
safe rectangle, with semantic/confidence and overlap checks. Unsupported manual
cuts or custom caption zones fail explicitly instead of being ignored.

No transcription sidecar is written beside API exports. Command-line use retains
its private plan sidecar. Subprocess stages receive abort signals; progress marks
completed analysis, planning, normalization, graphic rendering, encoding, audio
alignment and verification stages. No timer-based fake percentage or ETA.

## Executed

10 targeted planner/admission tests passed. Real isolated HTTPS owner MFA login →
47.1s private spoken-rush upload → Codie selection → real local ASR preparation →
actual original-animation rendering → preview playback → browser download/hash →
project retrieval after server restart passed. Sidecar absence asserted. Source
and media stay outside GitHub; no paid API, deployment, merge or production change.

Output 910×512 native landscape, 45.637007s, H.264/AAC, 6,195,323 bytes. Two reviewed
UI graphic directions, as displayed in the existing editor, are used (the earlier
CLI auto plan had four). Output AAC bytes match the independently verified CLI
source-segment concat whose six sampled lags were 0ms. Full decode passed.

Complete measured UI test ~50.759s; sampled aggregate process-group RSS maximum
766,476,288 bytes (~731 MiB). Not an exact kernel peak or hosting benchmark.

## Limits

Still partial: historical MX-18296.mp4 / MX-241.mp4 and isolated SFX not restored,
20 transcription review entries, no master fidelity or phonetic certification.
Horizontal beta only, no physical Safari test, no public HTTPS deployment.
No claim that every new speech topic is supported: unknown or uncertain graphic
cues are refused. The connection was tested in the task environment, not on OVH.
