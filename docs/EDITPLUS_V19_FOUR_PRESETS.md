# Edit+ V19 — 4 locked preset policies
Experimental branch. **NOT DEPLOYED / NOT MERGED.**
The policy module preserves native orientation and forbids replacing horizontal facecam with full-screen B-roll. Vertical UGC Natif, Impact and Alex may use semantic B-roll. Fonts are targets, not bundled files. Pinterest short links are references only; their imagery is not licensed or automatically imported.

Local evidence: four sample MP4 exports on real rushes were generated and decoded successfully at native dimensions/30FPS/audio. They are **not** quality-approved reference reproductions: overlays still require exact word alignment, face/object tracking, animation refinement, true font installation, SFX QA and end-to-end integration.

Integration required before release:
1. Call `applyV19Safety` after timeline planning and before stock selection/rendering.
2. Implement `graphicCues` as actual small floating overlays in the horizontal renderer; discard full-screen broll cues, not just metadata.
3. Implement format-aware font packs for four models with license checks and verify safe zones.
4. Use word-aligned timestamps and audio-mastered native FPS output.
5. Repeat blind tests on unknown videos and check social graphic licensing.
