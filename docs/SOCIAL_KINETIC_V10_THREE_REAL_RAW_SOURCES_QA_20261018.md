# Social Kinetic V10 — 3 real distinct rushes technical QA (18 Oct 2026)

## New source: `IMG_0522.mp4`

Source uploaded by the user. This is a genuine **third distinct scene**, not the earlier duplicated horizontal facecam.

- SHA-256: `5b05ad6e25080291a89a87ab6ad2f3e566787a7276994d6ed02949647e9f5bd9`
- Length: **30.1667 s**, **910×512**, **30 fps**, H.264, one **stereo** AAC track.
- Content: talking head with movable hand-held whiteboard and pointing marker. The writing, pointing hands, and face must remain unobscured.
- Audio transcript: **96 words / 5 sentence segments**, confidence **0.9487**; topics: start from zero, 90 days, skill, earn money or save time, defining the offer. **No provider-verified per-word timestamps available from this source yet.** Text must be human-corrected before subtitle QA.
- Source full FFmpeg decode: **PASS**.
- Eight-second FFmpeg transcode pipeline smoke: **PASS**, same 910×512, stereo preserved, exactly 1 audio track and full decode PASS. **This is not a complete Edit+/HyperFrames edit.**

## Three distinct physical files validated

| Scene | SHA-256 | Native size | Source audio | Full source decode | 8s pipeline smoke |
|---|---|---|---|---|---|
| A portrait talking head, 34.8s | `ac00cda651cf576d712cc374fa3a071b09eff23cec10e39131ba846e484a9c4c` | 512×910 | mono | PASS | PASS |
| B horizontal talking head, 44.5s | `ae7e4d754274bb1df8577f094c7ffc873cf7a42e2ecf2ae44b0fa7c4b1b09580` | 910×512 | stereo | PASS | PASS |
| C horizontal live whiteboard, 30.17s | `5b05ad6e25080291a89a87ab6ad2f3e566787a7276994d6ed02949647e9f5bd9` | 910×512 | stereo | PASS | PASS |

Five sampled gray frames per source pair differ considerably (mean absolute 0–255 difference ~45–57); hashes are unique. This validates 3 physically distinct sources, not fidelity of 3 finished edited products.

## Three commercial gates and real status

1. Word-level alignment: **CODE READY, SOURCE EVIDENCE MISSING** for IMG_0522. Worker staging uses Gemini `word_info`, remapped through cut plan; sentence interpolation cannot be falsely accepted. Need full word timestamps and audio check.
2. Original reference comparison: **NOT ACCEPTED**; moving face, marker, and real whiteboard text must remain visible. Need image-by-image safe zone proofs, direct video comparison, sound-effect listening, and user acceptance.
3. Three complete autonomous edited videos: **NOT COMPLETE**. All 3 originals available as actual files and have passed technical smoke and full source decoding, but three full HyperFrames end-to-end render and independent reviews have not been produced.

`assessSocialKineticV10CommercialRelease()` **must remain blocked** and now requires unique SHA-256 plus individual full E2E image/audio/word evidence for every source, not just 3 counts or technical smoke results. The PR is still draft; do not turn on production without evidence.
