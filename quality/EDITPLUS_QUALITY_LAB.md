# VIRAL STUDIO — QUALITY LAB (internal, non-production)

Status: **DESIGN/VERIFICATION GATE — NOT AN APPROVED COMMERCIAL RELEASE**
Started: 2026-10-09
Isolation: branch `editplus-quality-lab-v1`. **Do not connect this branch to production Railway, Supabase, or the public frontend.**

## Product contract: adaptive by source, not a preset with random effects

The client uploads one real video, chooses a style and output aspect ratio, and receives a coherent short-form edit. The system must interpret the source's *meaning*, speaker, gestures, useful pauses, arguments, concrete visual anchors, and visual composition before selecting any edit.

The system comprises three independently testable components:
1. **Viral+ diagnostic:** speech, picture and measurable technical signals are analyzed; diagnostics link to verifiable timestamps. Same bytes + analysis version must give same numeric score; distinguish measured evidence from model inference. No promises of views.
2. **Clip+ editorial selection:** identify complete, context-independent passages from source + spoken timestamps; no fabricated timestamps, forced quota, or generated quality scores in the absence of semantic evidence; retain hook, argument and payoff.
3. **Edit+ AI director + independent renderer:** semantic planner emits validated machine-readable edit decisions; renderer executes without editorial improvisation. Six *different* style grammars, each evaluated on real videos.

### Six target styles (none commercially certified)

| Style | Creative role | Critical difference |
| --- | --- | --- |
| Codie | Premium business documentary storytelling | Facecam dominant, narration-led A/B/C crops, selective photographic/documentary proof, restrained kinetic typesetting |
| Leila Hormozi | Strong, precise business leadership teaching | Distinct contract must be **derived from directly analyzed, lawful reference footage**; do not assume it is a Codie variant or invent its font/animation style |
| Impact | High-energy persuasive short | Faster, meaningful visual emphasis with clear spoken anchors and energetic sound, without metronomic cuts |
| Clean | Visually invisible premium editing | Minimal B-roll and graphics, exceptional audio, framing and typography |
| Explainer | Tutorial/instructional comprehension | Actual interfaces/actions, step hierarchy, visual proof synchronized to instructions |
| UGC Native | Authentic phone-style product/story | Gestures and real products preserved, cuts natural, no false or stock-synthesized testimonials |

These names are internal style descriptors and must not imply creator endorsement or affiliation.

## Baseline before the new engine (historical database snapshot, 2026-10-09)

- Viral+: 34 analysis rows, 16 distinct video IDs, across multiple scoring versions. In seven repeated (video_id, score_version) groups, six groups had more than one numeric score. **Numeric consistency NOT proven.**
- Edit+: 74 completed render jobs, median completion time ~217s, p90 ~644s (all sources/durations pooled). 51/74 exported render metadata had zero B-roll and average B-roll count was ~0.57. **These numbers are not proof B-roll should always appear, but they cannot demonstrate rich contextual editing.**
- Clip+: 27 completed and 36 failed historical jobs, median ~33s and p90 ~427s for completed jobs. These aggregate all prior builds; **never market them as current version performance or model accuracy**.
- Quality is **unknown** without independently evaluated real outputs, however successful MP4 encoding is not creative validation.

## Reference and source-video protocol

Create an explicit manifest only after verifying file availability and rights. Reuse previously supplied examples if accessible; do not falsely claim to have viewed missing videos. Do not collect Pinterest assets without licenses.

For each approved reference, independently record:
- frame-accurate timecodes of cuts, speaker shot/crop, caption in/out, text typography, sizes, colors, stroke/shadow, alignment and mobile-safe bounds;
- B-roll type, duration, specific claim illustrated, footage or still, source rights;
- actual music and SFX placement, dynamics, loudness and narrative purpose;
- gestures, meaningful pauses, on-screen hierarchy, visual cadence, hook and CTA.

**Six gold-standard edits** must be signed off by a professional editor/motion designer, not approved by source-code tests alone. Codie and Leila require separate professional reference analyses.

## First real benchmark: distinctiveness + accuracy

- Prepare four consented 30–60s sources: business facecam, business discussion/podcast, real UI tutorial, authentic product demonstration; French and English must both be represented, vertical and landscape where applicable. For source/style mismatches the director must give a meaningful warning and never invent footage.
- Render source-specific applicable style combinations; repeat exact same source 3 times to test idempotence and avoid incidental variation. Keep the raw source, input hashes, transcriptions, plans, outputs, timing, costs and actual FFmpeg probe data together.
- Evaluate every output against a professionally edited gold standard **blindly** on 1–5: story clarity, natural cuts, captions, subject framing, B-roll relevance, sound, authenticity and overall publishability. A panel of **at least three independent reviewers**, including an experienced editor, signs off.
- Critically disqualifying defects: cut that truncates meaning, fabricated claim or image, visibly misplaced/frozen frame, caption covering the face / UI safe zone, wrong orientation, incoherent insert, missing audio, unstable or uncapped progress, repeated false quotation or unlicensed asset.
- Functional test != human quality acceptance. The first "premium" approval requires at least 4/5 average on each rated dimension for every designated gold-standard source (any critical defect blocks), with a majority of reviewers preferring or finding output comparable to the benchmark editor's rendition. This is a **target, not a currently met score**.

## Runtime/scale acceptance criteria — proposed targets, not facts

- For 30–60s source on supported input: p50 upload-excluded processing <=120s, p90 <=300s at test load; record source bytes/resolution/codec and test concurrency.
- Reliability: end-to-end upload -> job -> preview -> download; no fake progress increments, retry loop or inaccessible export.
- Identical input/video hash + scoring model version: identical Viral+ numeric score; explanations can be separately versioned if regenerated.
- Every generated B-roll is licensed/owned, claim-specific, pixel-level inspected, and has traceable origin. Zero B-roll is the correct output if none fits.
- Every render must pass media probe (audio stream when input has one, correct duration/dimensions, no severe freeze/black segment), subtitle bounds checks and dialogue continuity checks. Failed QA -> **do not label READY**.

## Engineering work order (no aesthetic polish/deployment shortcuts)

1. **Evidence collection**: list actual available reference footage, production source videos, current outputs and licensing. Collect baseline ffprobe, timings, storage/job error rate from existing databases and workers.
2. **Reference grammar**: professional motion editor provides separate Codie / Leila timecoded dissection, then drafts remaining four; store six human-approved EDLs and typography/animation assets.
3. **Planning engine**: machine-readable Edit Decision List (EDL), fields for timestamp, source span, semantic evidence, intent, confidence, style rule, crop track, text assets, graphic shot, B-roll provenance, audio cue. Hard reject unsupported or low-confidence actions; adapt to each source instead of distributing N cuts.
4. **Renderer evaluation**: implement same 30–60s benchmark in Remotion and one professional timeline/renderer alternative; choose only using output fidelity, render latency, total cost, licensing and failure behavior. FFmpeg remains valid for preprocessing/encoding, not a sufficient production art director.
5. **QA harness**: deterministic inputs + outputs + frame snapshots + subtitle safety + audible continuity + comparison matrix. Compare the same source across the six models blind; verify that styles differ in narrative decisions, not only tokens.
6. **Closed beta only** after all approved benchmarks; 5–10 creators upload different real material, report objective issues and whether they would publish without extra edits.
7. **Commercial GO/NO-GO** requires the editor-signed quality suite, supported input matrix, clear pricing per render and latency/resilience data. No "final version" wording before that.

### Communication contract

- Never send a new public deployment link as proof of progress.
- Each update must show: **observed problem -> edited mechanism -> input(s) tested -> output/artifact -> actual quality verdict -> remaining risk**.
- Report tests as `passed`, `failed` or `not run`. A unit test passing does **not** confer cinematic/editorial quality.
- Production freezes until a benchmarked and independently reviewed engine is ready; ordinary security or availability fixes remain allowed after explicit risk assessment.
