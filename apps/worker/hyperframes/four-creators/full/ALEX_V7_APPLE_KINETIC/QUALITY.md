# Edit+ — Alex V7 Apple-inspired kinetic type
Status: staging demo, NOT deployed to Edit+ or production.

## What changed
- The six previous rectangular talking-head caption containers have been **entirely removed**: no box, border, colored panel, background fill, blur backing or pill.
- Floating, optical-clean typography in warm white and restrained champagne highlights, with optical shadow for accessibility.
- Each phrase has multi-step GSAP motion: per-token blur reveal, vertical movement, subtle scale, horizontal hairline, micro-lift of a single keyword, and floating end drift.
- The rest of V6 graphics are unchanged, including the crucial speech-story discipline: the early money scene never displays a person before the speaker has introduced helping others.
- Voice is always the source rush; original horizontal native aspect is preserved.

## Honest limitations
- Text words displayed on the facecam are *editorial emphasis labels*, NOT verified verbatim audio subtitles. The complete ASR word alignment for the source has not been confirmed. Do not claim frame-perfect synchronized subtitles.
- Animated text is staggered using editorial timings only; an exact-caption engine requires phoneme/word evidence, and render gating under `apps/worker/src/hyperframes-story-first-gate.js`.
- Avoid copying Apple trademarks or proprietary footage; "Apple-inspired" means minimal typography and restrained easing, not an Apple endorsement.

## Acceptance
- No rectangles behind any facecam text.
- Text does not mask the subject's face.
- Captions animate word groups entering, emphasizing and settling, not just showing a static title.
- Smooth V6 concept-card transitions remain unaffected.
- Full-length animation render, FFmpeg complete decode, original voice, no fake words/numbers.
