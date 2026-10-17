# EDIT+ — HyperFrames instructions for agents (2026-10-17)

## Mandatory workflow
1. Understand Edit+ is a **premium automated editor**, NOT a collection of caption templates. Liav is the creator; OMNI is the environment. Preserve native aspect ratio and source voice.
2. Read `MASTER_BRIEF.md` and `RESEARCH_SOURCES.md`. Four models: CODIE_DOC, ALEX_EXPLAIN, LEILA_EDITORIAL, GADZHI_CINEMATIC (Iman Gadzhi is only a provisional interpretation of “Gadji”).
3. For **ALEX_EXPLAIN**, MANDATORY FIRST: read `references/alex-hormozi-20261017/AGENT.md`, `MODEL_RULES.md`, `REFERENCE_SHOTS.md`, `MODEL_OVERRIDES.json`. These 3 new actual user-provided references override old cream/beige infographic assumptions. They have full-screen navy charts and sequential white/yellow builds. Videos remain private; the GitHub branch stores analysis only.\n4. Before mimicking a creator, inspect **actual primary-source videos** and log timestamped cut, motion, caption, and sound decisions. Initial documentation is a research **hypothesis**, not a certified scene-by-scene audit.
9. Have a verified word-aligned transcript, source-to-output time remapping, pose/face/hand proof, B-roll license checks. Never invent captions, metrics, conversations, prices, or facts.
9. Plan intent first. Compose each style separately using HTML/CSS/seekable JavaScript/GSAP. `hyperframes lint`, `hyperframes check` where supported, `hyperframes render`, then decode MP4 fully with ffmpeg and inspect frame samples.
9. Use exactly the **same raw video**, with identical original voice, in 4 side-by-side style tests. If outputs are distinguishable only by color or font, reject the batch.
9. Deliver preview MP4, final MP4, visual contact sheet, annotated timeline, technical QA and critical editorial QA. No “100/100” without reviewer validation.
9. No deployment to production Railway without a separately approved E2E release. Never commit personal videos or credentials to a public repository.
Reference: https://github.com/heygen-com/hyperframes
