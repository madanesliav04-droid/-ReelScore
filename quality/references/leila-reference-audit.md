# Reference dissection: Leila Hormozi — source-specific study
**Internal research only; not a style licensed or endorsed by the creator.**
**Analyzed:** user-supplied 49.51-second screen recording, 512×1112, H.264/AAC, 2026-10-09.
**Method:** 2-second contact sheet plus visual spot-checks at 5s and 25s; FFmpeg scene score sensitivity trials. No source authoring project, original clean raw video or font files are accessible. All boundaries approximate unless later inspected frame-by-frame.

## Crucial attribution: ignore the Instagram interface

The screen recording contains mobile OS controls at the beginning, Instagram chrome at the top and bottom, view counts, social action icons and a lower account/caption bar. These are **not** part of the creator's artistic template and must not be recreated. Crop/ignore them in all visual measurements. The original editorial canvas inside the Instagram screen can have different dimensions/safe zones from the screen recording.

## Grounded timeline observations (approximate visual sampling)

| Time | What is visibly observable | Design consequence |
|---|---|---|
| 0–2s | Phone control-center overlay, then the social-media video appears | Recording artifact, not a hook template |
| 2–8s | Speaker lower-center; spacious top has **two-column hourly-rate comparison**, thin horizontal lines, restrained narrow elegant serif for figures and labels | Analytical opener: comparison graphic uses open upper space without obscuring hands/face |
| 8–12s | Shot shifts within frame, arms/hands stay visible; sparse text/data elements behind or beside speaker | Prioritize human presentation; don't rely on timed punch-ins |
| 14–19s | Speaker partly outside left area; background typography includes comparison labels and contextual phrases (more hours/sleep tradeoff) | Scene/subject can recompose to reserve a real explanation zone |
| 20–28s | Facecam recenters; short supporting text above subject; a prominently styled hourly figure appears, then fades in favor of speech | Facts appear when relevant, not as permanent decoration |
| 30–34s | Example of service work begins with '2 hours' context, shown as muted serif/formula-style type at top | Create title/subtitle hierarchy with proof context |
| 36–44s | Arithmetic/equation visuals update across narration (e.g., hours and costs); speaker remains central | Use explicit figures from source, transition only when speech justifies; **never calculate or invent unstated outcomes** |
| 46–49s | More prominent speaker/closer crop and small lower text; final thought emphasized by facial expression | Preserve calm delivery; no aggressive transition or repetitive zooms |

## Editing grammar extracted as a hypothesis, not assumed universal

1. Primary visual: business facecam; meaningful hand gestures are preserved.
2. Storytelling: argument-by-example/comparison; animated visual **information** carries the complexity rather than montage frequency.
3. Typography: large, refined light-on-muted-neutral serif for high-level quantities; supporting smaller sans may be used where visually justified. **Exact font family unknown**, Noto Serif is only an initial engineering stand-in.
4. Graphics: aligned columns, subtle separators, calculations, open negative space, understated fade/tween; values must trace to actual spoken evidence and their timing.
5. Background: natural neutral brown/gray, no vivid theme colors, no decorative frames covering the hook.
6. Framing: variations include central facecam and side/off-center speaker used to give numbers room. Crops must keep head and hands, not blindly center and cut.
7. B-roll: no obvious unrelated stock cutaways in sampled section. Do not add arbitrary stock to this grammar.
8. Sound: **not evaluated** in this visual pass; cannot claim to have reproduced actual music/SFX or mastered audio yet.
9. Pacing: scene detector found 2 events at threshold 0.15 (~18.33 and 19.7 seconds) and none at 0.28, but this does **not** exhaust camera jumps or overlay transitions. Do not convert to claim of 'exactly 2 cuts.'

## Engineering contract, requiring an actual source-aware EDL

- Detect trustworthy semantic cue: compare person A/B, cost, time, quantity, consequences, explicit example, list or equations.
- Maintain separate audio-linked word timestamps, not coarse sentence blocks. If only 24s segment timing exists -> block precise effect rendering and request word alignment.
- Output structures: `comparison_columns`, `spoken_number`, `spoken_equation`, `business_example`, `facecam`, `subtle_crop`.
- No numerical result appears without a direct source claim or an explicitly verified computation visibly explained as derived, with source/provenance.
- Do not place any graphics on top of face/hands. Track actual speaker location before choosing negative-space placement.
- Fonts/sizes/color from this one reference are prototypes pending further references and calibrated frame comparisons.
- **Mandatory next evidence:** upload/obtain an owned unedited facecam video with word timing, render side-by-side Leila experimental and Codie experimental using same source, inspect MP4. Current reference is someone else's published edit, not original raw client footage.

**Status:** inspected real reference and recorded edit grammar. **Not** a working fully automatic Leila-style renderer, and **not** creator-certified.
