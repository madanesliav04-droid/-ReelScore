# Edit+ — Cinematic Storytelling V2
**Standalone engine handoff for the future Social+ rebuild with Codex.** 
Status: implementation and CI review; not a locked golden master. Supabase, Railway and the existing Social+ frontend are not required in the final architecture.

## Positioning
Documentary, cinematic business storytelling **inspired by the editorial principles** of Johnny Harris, Vox and MagnatesMedia — not a frame-for-frame imitation or imitation of their assets. The editor understands the speaker and chooses *why* and *when* an image or motion adds information. **No empty motion quota and no invented proof.**

## Contract (must be met)
1. **Input:** original video + original voice, timed verified transcript, source dimensions, measurable silence spans, optional verified visual-intent quotes and user-licensed B-rolls. Reject missing/misaligned word timestamps instead of inventing text.
2. **Narrative:** identify hooks, stakes, turns, proof and resolutions *only if supported by spoken words*. A flat speech without evidence yields zero extra scenes.
3. **Cuts:** remove unnecessary silence longer than 1,100 ms only; keep up to 280 ms of lead/trail at valid long-silence edits. Protect the first 400 ms and last 900 ms; never cut over a spoken word or within 150 ms of it. Respect intentional emotional pauses.
4. **Camera:** max two soft scene-driven moves on verified transcript beats, ~1.028x and translations less than half a percent. Ease in and out; no jump zoom at every five seconds. Horizontal remains horizontal without bars added to the source.
5. **Narrative typography:** premium restrained documentary titles in the upper zone; display every word only at or after its spoken start time. No statistics, chapter labels or screen graphics without verified source evidence. No generic numbered boxes or permanent subtitles panel.
6. **Captions:** verbatim ASR, ≤5 words per segment, active word synced, 115ms entrance, hold the completed segment up to 180ms unless next segment begins sooner. Adapt ink colors to sampled frame luminance, preserve legibility and safe zones. No word displayed earlier than audio.
7. **B-roll and 2.5D:** select genuine licensed footage relevant to each sentence. Make scene depth via tracked subjects, mattes and verified real visual layers. **Current V2 has only subtle camera movement and typographic depth; it does NOT yet implement production 2.5D segmentation, tracking or actual narrative B-roll insertion.** Never claim otherwise.
8. **Audio:** source voice remains original, no voice synthesis, pitch alteration or doubling. Single audio program, -16 LUFS and -1 dBTP targets, instrumental licensed music and natural SFX only when editorially warranted. **Current renderer has loudnorm targets but music/SFX, integrated true-peak measurements and listening QA are pending.**
9. **Output:** native source ratio, H.264 MP4, 30 fps, no intentionally truncated ending, no artificial fade to black at the end. Test export content from first syllable to final frame.
10. **Portability:** separate pure planners `src/cinematic-intent.js` and `src/cinematic-motion.js` from providers. Keep rendering dependent only on a video source, the timeline contract and media assets; inject Auth/DB/Storage adapters separately in the future Codex project.

## V2 implementation
- `apps/worker/src/cinematic-intent.js`: evidence-based beat selection + exact words and timing for animated narratives.
- `apps/worker/src/cinematic-motion.js`: protected-cut windows, narrative zoom/drift cues, caption hold windows.
- `apps/worker/src/edit.js`: native dimensions, validation and V2 timeline contract.
- `apps/worker/remotion/VideoEdit.jsx`: cinematic type reveal, layered text depth and ease-in/out camera treatment.
- `apps/worker/src/render.js`: isolated cinematic master settings.
- `apps/worker/tests/cinematic-motion.test.mjs`: timing/ending/content/no-fake-motion checks.

## Visual QA gate before 100/100
| Requirement | Points |
| --- | ---: |
| Story logic and semantic evidence | 20 |
| Professional motion/cuts and no black gaps | 15 |
| Relevant B-roll and real 2.5D layers | 15 |
| Word-for-word captions and visible contrast | 15 |
| Original voice fidelity and sound design | 15 |
| Native ratio, safe zones and export validation | 10 |
| Consistency across three different rushes | 10 |
| **Total** | **100** |

**Acceptance:** render three full MP4s (horizontal, vertical and difficult backlight), check exact source-dialogue alignment, first/last frame, black frames, clipped words, speech peak, audio LUFS/dBTP, media provenance and visual polish. No fictitious score or "100/100" before this human + automated QC passes.

## Explicit non-goals
- Do not repair or connect the old Supabase instance in this model work.
- Do not merge into the existing production branch or activate a service without a tested real-video MP4.
- Do not use invented stock URLs, made-up statistics or empty 2.5D claims.
- Do not create the complete Social+ UI yet. The model is to be handed to Codex with the other locked models and UI specification later.
