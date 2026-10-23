# Social Kinetic V23 — référence d'animation adaptée au discours réel
Source: ScreenRecording_10-16-2026 16-17-09_1(3).mp4 (55.1667 s, capture Instagram). Original visual canvas only is 512×288 within 512×1112. UI Instagram and the incoming OS notification around 48s are deliberately excluded.
Target: IMG_0506(1).mp4, 910×512 horizontal 30fps, cut plan V21/V22 (1,233 frames, 41.1s).

## Reference chronology
0–3s deep-green oversized kinetic impact with white hierarchy; 3–10s micro white words in negative space; 10–18s progressive blue bubble stack; 18–24s quiet white typographic flow; 24–30s second and third green impacts; 30–46s minimal floating captions; 46–51s grounded numerical concept; 51–55s quiet closure. Approximate time windows are visual inspection, not access to original project/keyframes.

## Composition
This HTML is based on the confirmed V16 edit grammar and adds non-destructive V23 restaging, original reference hierarchy, and a deterministic 42.03→41.1 s cut map. Preserves white V16 word styling, native 16:9, green emphasis, semantic blue cards. The numerical metric module is **disabled** because the source speaker says no comparable amount. Word timestamps are approximations from sentence-level transcript (NOT forced aligned). Screen recording audio, Apple sounds, third-party assets and Instagram UI are not used.
`window.__timelines['editplus-sk-v23-reference-fidelity']` exposes GSAP timeline. Test: `hyperframes lint` and `hyperframes render --format webm --fps 30`. Compose output alpha over cleaned 41.1s original source frames **not V22 already overlaid**, with user-owned voice. Avoid false proof: full facial/hand tracking, fully autonomous Edit+ worker E2E and 3 independent videos are still release blockers.

## Acceptance gate
- Full real HyperFrames CLI render passes in CI.
- Final H264/AAC decodes fully, video 1233 frames, one unchanged voice track, loudness ~−16 LUFS true peak ≤−1 dBTP.
- No subtitles on face/hands, no off-frame text, no two simultaneous identical captions.
- Verified native word timings or explicit estimated timing fallback.
- Mobile visual approval and 3 independent inputs through Edit+ before public release.
