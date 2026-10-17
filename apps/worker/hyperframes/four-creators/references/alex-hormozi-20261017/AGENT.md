# Edit+ → HyperFrames — Alex Hormozi reference handoff (2026-10-17)

READ FIRST before coding / rendering Alex style. This replaces any previous beige-card or small-sidebar assumption.
1. Read **ALEX_V3_BRIEF_OBJECT_MOTION.md FIRST**, then MODEL_RULES.md and REFERENCE_SHOTS.md. V3 adds semantic object motion in addition to full-screen navy infographics; don't render old basic text slides as the final V3.
2. Inspect all 3 PRIVATE user-provided reference clips, if available; do not invent frame-by-frame details.
3. Analyze the client's whole raw footage, source words and reliable time alignment; plan editorial cuts, narrative visual scenes and their precise post-cut timings.
4. Render full-screen navy business diagrams and their stepwise animation with HyperFrames HTML/CSS/seekable GSAP — not an arbitrary title animation library.
5. Keep native aspect, original human voice, exact subtitling and no misaligned cuts.
6. Provide real licensed evidence if a proof insert is editorially justified; **never reuse reference stats/footage** in customer render.
7. Render **entire** requested video, perform full decode, frame/face/hands and audio QA. Don't claim fidelity or ready-to-sell status without visual reference comparison.
8. The app's edit director chooses WHEN and WHY; HyperFrames executes the deterministic visual scenes. An unconnected agent has NOT seen the private video merely because this file mentions it.

PRIVATE_MEDIA: Original user reference videos and cropped players are in a separate private ZIP sent to user, not in GitHub.
PRODUCTION: No automatic Railway production switch or model deployment until full E2E testing.


## V6 CRITICAL REGRESSION — USER REVIEW 2026-10-17
The source video at ~12.8s in V5 showed `money -> arrow -> person` **before the user had actually said the part about helping someone**. This is an editorial failure, regardless of technical render/audio QA.

NON-NEGOTIABLE: The timeline must be authored FROM source-aligned meaning, not source-timed placeholder slides. Use `apps/worker/src/hyperframes-story-first-gate.js` on every semantic visual, subtitle and object.
- Each object has `spokenEvidence` (exact transcript phrase), `firstWordMs` from verified word-aligned speech, `sourceEndMs`, `motionSpec`.
- `object.startMs >= firstWordMs`; for cause/effect, show the second object only after its concept is introduced.
- No word alignment => HOLD the semantic object and fall back to facecam; **do not** substitute an acoustic pause/restart.
- Existing V5 scene 10.93–14.45s containing a person is REJECTED. Never restore it before explicit speech evidence.
- Test against uploaded original `IMG_0506(1).mp4`, do NOT infer transcript from the previous graphics.
- The input video has no verified word-level timestamps in the current handoff. Exact V6 sync must not be claimed until that evidence exists.

Acceptance: The viewer never sees an answer before it is spoken. Intro visual shows only information already introduced; mechanisms unfold progressively as said.
