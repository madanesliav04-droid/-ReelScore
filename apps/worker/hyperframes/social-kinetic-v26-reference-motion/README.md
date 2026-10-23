# Social Kinetic V26 — V25 specification implemented
- Input reference master V25 (55.17s) informs geometry, timing proportions, palette and the **4→3** bubble stack choreography.
- Actual overlay for current 41.1s user voice and 8-cut EDL. White V16 micro captions; green semantic hero; four short blue cards which actually **rise as new ones enter, evict first, vanish**.
- Visible cards use actual speaker statements: "LES PERSONNES", "PRÊTES À TE PAYER", "GAGNER DU TEMPS", "GAGNER DE L'ARGENT". The reference's COACH, 3, and 3000/1000 EUR are **NOT** copied because not voiced by the current user.
- SFX are not copied from the third party; audio is taken from V22 as a single unchanged AAC bitstream in final composition.
- GSAP animation is precomputed on one timeline with seekable deterministic FLIP-style vertical reflow and three green semantic bursts.
- Source word timing remains **approximate**, not verified acoustic forced alignment; commercial release remains blocked.
- Run `hyperframes lint .`, `hyperframes render --format webm --fps 30`, then composite the overlay alpha onto CLEAN source EDL (not V23/V22 burned graphic).
- Technical GA CI render runs on push to this branch.
- Manual aesthetic review (iPhone), full hand/face QA, and 3 independent UI uploads/exports before public commercial rollout.
