# Edit Beta — Product specification

## Core promise
Upload a raw video, choose an editorial language, receive a ready-to-post short-form edit. The product edits existing footage; it does not rewrite scripts or hooks.

## Beta user
First beta tester: owner/admin. Beta mode is unlimited and does not require payment.

## Platforms
Instagram Reels, TikTok, YouTube Shorts and other 9:16 short-form destinations.

## Editing languages
- Authority: facecam first, narrative cuts, intentional punch-ins.
- Punch: dense, fast, higher visual change rate.
- Story: more breathing room, contextual visual cutaways.
- UGC Native: natural and intentionally less polished.
- Podcast: conversational rhythm, tighter framing, strong captions.
- Minimal: invisible cuts, premium typography, rare effects.

Public product copy must never use creator names for presets.

## V1 workflow
1. Upload local video (MP4/MOV/M4V/WebM, up to 5 min).
2. Choose editing language.
3. Choose caption style, language, font, position, render quality and B-roll mode.
4. Local audio analysis detects silence and audio-energy emphasis.
5. Local Whisper transcription is attempted with word timestamps. Manual transcript is the fallback.
6. 9:16 render is generated locally using Canvas + WebAudio + MediaRecorder.
7. User previews and downloads the result.
8. User can request deterministic post-edit changes in natural language and regenerate without retranscribing.

## Caption styles
Highlight, Monoline, Multi-line, Classic, Karaoke, Minimal.

## Export
- 720×1280
- 1080×1920 default
- 2160×3840 / 4K quality mode
MP4 is preferred when supported by the browser; WebM is a fallback on browsers whose MediaRecorder cannot produce MP4.

## Privacy
Source video stays on the device in the beta. It is never used for model training. Browser-local project metadata may be stored in localStorage. Cloud storage is not enabled in the beta.

## B-roll strategy
V1 can identify contextual B-roll opportunities from transcript keywords. Automatic licensed stock ingestion is deliberately not required for the zero-cost beta because free stock APIs generally require external keys and introduce licensing/dependency risk. Generated visual cutaways are the preferred zero-cost direction before third-party stock integrations.

## Product priorities
1. Editing quality
2. Speed
3. Premium design
4. Simplicity
5. Zero connector cost

## Beta acceptance test
A real iPhone rush must upload and display, silence removal must produce real cuts, captions must render, punch-ins must be visible, the file must export and play, and a chat correction must be able to regenerate without re-transcription.
