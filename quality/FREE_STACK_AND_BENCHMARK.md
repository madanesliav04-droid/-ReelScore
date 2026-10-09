# Viral Studio — verified €0 tools and benchmark protocol
**Date:** 2026-10-09
**Isolation:** branch `editplus-quality-lab-v1`, not connected to production. **No new commercial release.**

## Primary stack: only activate after a controlled benchmark

| Role | Candidate | Verified capability | Price / caution |
|---|---|---|---|
| Semantic editorial director | Existing Gemini integration | Actual multimodal analysis and timestamped transcription pipeline already exists | Reuse current account; API costs are separate and outputs must be validated |
| Programmatic visual renderer | Remotion | React video compositions, typography, motion graphics, downloadable MP4 | License free for individuals and organizations with <=3 members under current terms, including automation. Compute still costs money. https://www.remotion.dev/docs/license/pricing |
| Headless open-source motion alternative | Motion Canvas | Timeline-programmed vector animations / real-time preview | MIT at inspected GitHub release; inspect current dependency/license before commercial use. https://github.com/motion-canvas/motion-canvas |
| Speech activity | Silero VAD | Distinguish spoken pauses from low-volume environments | MIT; install/evaluate separately, compare existing ffmpeg silencedetect. https://github.com/snakers4/silero-vad |
| Word timing | faster-whisper + WhisperX | Local transcription and forced alignment; speech-to-word timing QA | MIT for faster-whisper, BSD-2-Clause for WhisperX; models and GPU/CPU cost separate. https://github.com/SYSTRAN/faster-whisper and https://github.com/m-bain/whisperX |
| Subject framing | MediaPipe | Face landmark/subject anchors for crop; privacy and metrics disclosures must be reviewed | Source Apache 2; model/dependency licenses separate. https://github.com/google-ai-edge/mediapipe |
| Objective shot detection | PySceneDetect | Real shot-cut/scene detection and still-frame sampling | BSD-3-Clause. https://github.com/Breakthrough/PySceneDetect |
| Baseline comparison | Auto-Editor | Silence/motion trims; compare against our basic edit performance | Repository Unlicense; distributed binaries can have different licensing. https://github.com/WyattBlue/auto-editor |
| Playback/container/video QA | FFmpeg, FFprobe | Media validation, audio presence, black frames, loudness, dimensions | Already in our stack; review deployment LGPL/GPL build compliance. https://ffmpeg.org/legal.html |

## Benchmark tools, not production dependencies

- **Descript Free** may give reference exports and transcript-based editing, but free tier has restricted 720p outputs, limited AI credits and current pricing shows watermarks. It is **not** a free production API. See https://www.descript.com/features
- **Adobe Express Free** is a useful reference for fast subtitles, brand typography and stock ideas, but not proof of automatable render quality. See https://helpx.adobe.com/express/web/adobe-express-subscription/free.html
- Our already-connected **BlitzReels** library has previously uploaded real sample Reels; those can be used as a comparison corpus if source reuse/consent is appropriate. No benchmark has yet rendered six new edits from them.

## Stock-media alert

- **Pexels** newly issuing API keys is paused as of 2026-10-09; do not build an indispensable dependency around obtaining one: https://help.pexels.com/hc/en-us/articles/900004904026-How-do-I-get-an-API-key
- Pixabay content is not redistributable standalone: read each applicable license/terms and retain provenance. https://pixabay.com/service/license-summary/
- User-owned files and explicitly approved, licensed stock must take priority. Absence of appropriate footage should produce zero B-roll, not a generic filler shot.

## What is actually tested today?

`quality/tools/check-render.mjs`: FFmpeg/FFprobe integrity gate with real encoded synthetic MP4 fixtures, no external npm deps.
- One decodable test video with audio -> PASS.
- One decodable black video -> FAIL as LONG_BLACK.
- One decodable test video missing sound -> FAIL as NO_AUDIO.
- GitHub Actions for branch `editplus-quality-lab-v1` passes the 3 smoke tests; this proves **media integrity checks only**. Does **not** certify visual/creative quality.

Run locally from repository root:
```bash
node --test quality/tools/check-render.test.mjs
node quality/tools/check-render.mjs path/to/export.mp4
```

## Next development slice — explicit GO/NO-GO

1. Compare the 6 style outputs using **same real source** and human-reviewed gold-standard references. Do not infer Leila Hormozi's actual typography/crop grammar without lawful reference footage.
2. For each source, Gemini produces a machine-readable Edit Decision List (EDL) with actual source timestamps, spoken evidence, confidence, crop target, caption, graphic intent, optional B-roll provenance and licensed audio cues.
3. EDL validator rejects unsupported claims/shot requests and arbitrary cadence. No forced B-roll, no periodic zoom.
4. Compare Remotion with current FFmpeg on at least 1 uncut business facecam source. Check frame quality and export duration. Never claim to have evaluated Remotion before a real test.
5. Execute `check-render` for every export and **also** require blind visual/editorial human evaluation of actual MP4: face, captions, safe zones, audio, cut continuity, narrative and B-roll relevance.
6. Optimize after first valid creative benchmark (p50/p90 and error telemetry), not before.

**Communication standard:** only report real output, actual test and verdict. Never treat a successful CI run or a new style-token value as a release.
