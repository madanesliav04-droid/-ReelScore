# Codie V60 horizontal input port — partial beta, 2026-11-05

Follow-up: the opt-in partial interface connection is now tested; see
`CODIE_UI_BETA_20261105.md`. The initial CLI-only evidence below is retained.

The original build_v60.py remains unchanged (SHA-256
0127903c5b2a7674cf669730d0f1c73d466510572e034e2c4c3c80cf0b60a205).
New input/IO glue reuses its tile drawing function and complete original
overshoot/rise/ring/fade loop through AST loading. Historical main code is not
executed. Two Python tests compare portable frames against the original loop
body at seven phases and verify transparency outside cues. Four Node tests check
source binding, deterministic word-derived cues, uncertainty/portrait refusal,
caption header separation, and original-source overwrite refusal.

Only original caption STYLE metadata was retained, not any historical dialogue
or timestamp. New source words/timings come from real local Whisper. Existing
licensed bundled font used, with explicit family alias. New groups fit the native
caption width and active words use the original lavender color. Icon anchors are
clamped for safe native-frame bounds; no automatic scene/face placement certification.

## Real test

Existing private horizontal spoken source, 47.1 seconds, 910×512. Fresh offline ASR
→ measured safe pause cut → four source-word-triggered clock/euro cues → original
animation frames → original caption grammar → H.264/AAC MP4. No old source camera,
old narration, subtitle timings or master video used as render inputs.

Output: 45.637007 seconds, 910×512 retained, 6,224,956 bytes, one AAC track; complete
decode passed. Six audio comparisons across both retained ranges: correlation
>0.9994 and sampled lag 0 ms. The first audio check detected a 13 ms post-cut pad
from shared A/V concat. Correction independently concatenates original audio and
copies the compressed video stream unchanged; packet hash before/after checked.
No animation/video rerender was needed for that correction.

Initial render ~39.3 seconds, followed by the targeted audio remux/verification.
Sampled process-group RSS ~693 MiB; not an OVH or concurrent-load benchmark.
First render attempt also exposed a missing duration configuration field in the
new launcher; fixed before successful export. No failed check counted as passed.

## Explicitly NOT a complete validated model

- MX-18296.mp4 / MX-241.mp4 historical inserts missing, stock source licences not
  confirmed. No replacement B-roll invented. Original master narration/SFX are
  not reused; isolated historical SFX stems unavailable.
- 20 transcription review entries, including 4 multiword timing groups; no phonetic
  confirmation. No claim of full visual fidelity, 100/100 or publication readiness.
- This is a horizontal CLI beta. Codie remains disabled in the application catalog;
  no authenticated UI/queue or physical Safari test for this port.
- Other five artistic engines unchanged; locked V28 integrity check passes.
- No paid API/service, deployment, production change or PR merge. Private sources,
  reference screenshots, transcripts and MP4 stay outside GitHub.

Command (with existing FFmpeg/Python/Pillow and local Whisper configured):

    node apps/socialplus/scripts/render-codie-v60.mjs --input rush.mov --output codie-beta.mp4

The original rush/audio/timings are no longer prerequisites for this partial port.
Full V60 restoration remains separate from this graphics/input compatibility proof.
