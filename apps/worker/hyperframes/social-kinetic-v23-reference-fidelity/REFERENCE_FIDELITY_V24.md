# V24 — Reference fidelity delta specification (2026-10-18)

This document extends the V23 model without claiming commercial readiness. Master reference: `ScreenRecording_10-16-2026 16-17-09_1(3).mp4`, 55.166667 s, 1655 frames @30fps, screen capture 512x1112. **Film crop** x=0..511,y≈359..646 => 512x288. Discard Instagram UI/icons/OS notification. Target original `IMG_0506(1).mp4`, approved 41.1s /1233frames, 910x512. Keep original vocal track.

## Measured time windows (compressed-pixel measurements)
| element | reference sec | observed geometry in film's 512x288 |
| --- | --- | --- |
| Opening huge green COACH | 0.000–0.733 | approx x30..479 y65..172 |
| Big green numeral 3 | 1.000–3.200 | approx x270..334 y49..137 |
| Blue four-message progressive sequence | 10.267–17.633 | x≈332..468, first card y193 at 10.5s |
| 2 cards | 12.3s | y≈155,195 |
| 3 cards | 13.8s | y≈93,141,183 (earlier cards MOVE UP) |
| 4 cards | 16.2s | reflow complete, approx y80..230 |
| green EN CALL | 24.300–26.333 | x250..388 y161..189 |
| green UNE OFFRE | 28.733–30.033 | x246..428 y139..171 |
| money module | ~45.9–50.9 | label OFFER PRINCIPALE -> 3000 EUR -> 3 chips 1 MOIS -> white-selected chip -> OFFER D'ATTRACTION 1000 EUR |
Pixels are from lossy screen recording; no claim of native font/color/keyframe extraction. Composite medians: blue RGB≈(12,99,188) / #0C63BC, opening green RGB≈(46,95,52) / #2E5F34.

## Source reference motifs
0-3.2 oversized green COACH→3 with white stagger; 3.4-10.267 quiet micro-white captions; 10.267-17.633 **4 blue SMS** (1→2→3→4 then 0) with upward FLIP reflow; 17.7-23.5 white summary and two-line checklist; 24.3-26.33 EN CALL with white fragments; 28.73-30.03 UNE OFFRE; 30-45.9 minimal white speech captions; 45.9-50.9 metric comparison; 50.9-55.17 quiet white closure.

## Required V23→V24 engineering changes
1. Separate `HeroOversize`, `HeroCount`, `HeroMid`; only opening goes near full frame. Use measured relative sizes, not same 70px hero everywhere.
2. `MicroCaption`: target strict scale approximately 15–23px on 910x512, creator-mobile-legibility mode 21–28px; use actual speaker words. Never fake word-level alignment.
3. `ChatStack`: prior cards must **reflow upward** each time new card arrives. Each card different height/width, independently animated 160–240ms; prior card movement 200–330ms. Use deterministic precomputed FLIP/GSAP state for HyperFrames frame seeking.
4. `Checklist2`: two stabilized white summary lines distinct from regular captions.
5. `MetricCompare`: label, 3000 value, three 1-month chips, selected white chip, replacement 1000 value, only when the speaker ACTUALLY mentions comparable data. **Disabled on current target**.
6. Use source-owned clean frames, 16:9; preserve 41.1s source cut EDL and single voice. Protect face/mouth/hands. Blue palette must be calibrated against #0C63BC rather than overly bright cyan.
7. Original Instagram UI and original Apple/third-party sound assets are not licensed. No fictional chat transcripts, currency figures, or unapproved brand overlays.
8. Motion reconstructions (not original keyframes): micro caption enter 120–200ms, hero enter 180–300ms power3.out, blue card enter 160–240ms, chat reflow 200–330ms. One sound cue on **new bubble**, none on prior bubble reflow.
9. Validate full official HyperFrames CLI render then final compositing; side-by-side at 0/0.4/1.2/2.8/10.5/12.3/13.8/16.2/17.9/24.5/28.9/46.8/48.2/49.5/51.6 seconds (reference-local), adjusted **semantically** for target dialogue. No false 1:1 time mapping to different speech.
10. Keep PR draft/release gate: no certified forced word timing, no 3 independent Edit+ UI→worker→MP4 tests, no full 1233-frame independent face+hand safety or iPhone artistic approval.

The full 19-page specification with 29 event manifest and 1,655 frame HSV mask telemetry is delivered as a separate user artifact; this GitHub file is the implementing deltas. **Do not claim pixel-perfect recreation from a compressed screen recording without source layers/stems.**
