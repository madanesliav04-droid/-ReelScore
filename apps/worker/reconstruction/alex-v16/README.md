# Alex V16 reconstructed fullscreen scenes — raw-rush worker integration

The original four Alex modules and the five other artistic models are unchanged.
The newly authored reconstruction is now wired to a **dedicated** worker branch,
not a creator_clean/Remotion/ASS fallback. Activation remains disabled by default
pending visual/phonetic approval. No service, schema, deployment or flag has
been changed remotely.

## Real raw-rush entry point

```sh
node apps/worker/scripts/alex-v16-raw.mjs --input RAW.mov --output NEW.mp4 --review-draft
```

Configure local Python with Pillow, numpy and faster-whisper 1.2.1, FFmpeg and
existing Whisper small weights via `SOCIALPLUS_ASR_MODEL_DIR`. Optional
`SOCIALPLUS_ASR_MODULE_DIR` selects already installed Python modules;
`SOCIALPLUS_PYTHON` selects the interpreter. No model/API download or external
transcription is performed by a render. `transcribe_local.py` is reused unchanged
from existing Social+ code; its provenance hash is in `asr-provenance.json`.

`alex-v16-pipeline.js` checks the uploaded source, measures actual streams and
silences, transcribes locally, builds speech-evidenced scenes, maps every word
through retained ranges, normalizes native MOV frame pacing, renders the complete
video, and verifies the MP4. AAC is copied when no cut requires re-encoding.
The existing authenticated job, timeline, storage and export persistence code
calls this same renderer when explicitly enabled. Other styles retain their path.

Cuts require a measured long silence between completed sentences plus 160ms
word margins. No filler or phrase is removed merely to create a cut. This test
rush had no eligible pause, so no cut was invented.

**Bounded planning:** the first deterministic editorial rule set handles French
business advice contrasting explanation versus an existing problem, easier
sales and a solution demonstration. Labels/headlines and cue positions are
extracted from actual words. Other content is rejected with
`ALEX_SCENE_EVIDENCE_REQUIRED`, rather than receiving invented/generic graphics.
This is not a general semantic engine for arbitrary subjects.

`--review-draft` explicitly permits an unreviewed automatic transcript in a
control export. It NEVER marks words as human-confirmed. Without it, unreviewed
transcription is held. Review warnings and source-bound word indices are saved
privately. A cached transcript must match the SHA-256 of the actual input.

The worker and Edge gates are `ALEX_V16_RECONSTRUCTION_ENABLED`; the worker's
separate `ALEX_V16_REVIEW_DRAFTS` flag is necessary for unreviewed control exports.
None is enabled here. The frontend remains unavailable by default. The Docker
variant requires `--build-arg ENABLE_ALEX_OFFLINE=1`, plus a privately mounted
existing model directory. No weights are included in the public repo/image.
This image variant and live Supabase persistence have not been deployed/tested.

```sh
node apps/worker/scripts/alex-v16-upload-test.mjs RAW.mov PRIVATE_DIRECTORY
python apps/worker/scripts/verify-alex-v16-raw.py PRIVATE_DIRECTORY
```

The first command is an actual loopback authenticated upload/render/Range/download
integration harness. It uses fresh ASR and the shared worker function, not a demo
MP4. It is **not** the hosted Supabase/Vercel API or physical Safari. The verifier
checks decoded active-word glyph pixels and original AAC identity; these are
not independent phonetic verification of spoken words.

Typography: existing licensed Inter variants, stable balanced caption groups,
18–28px portrait diagram text and 24px captions at width 512. Portrait uses a
native responsive vector layout, not a shrunken landscape card. Historical exact
font identity remains unproven. Landscape reference drawing remains available.

## Isolated compositor and reference comparison

`scenes.py` draws only the question/value/chain compositions, with explicit text
and output-timeline cue parameters. It never reads a master, source image or
reference audio. Existing licensed Inter subsets are reused unchanged; their
hashes and OFL notice are in `fonts/`. Their exact identity with the old master
font is not established. No stock insert or generic artistic preset is used.

## Run locally

Python 3.12+, FFmpeg/ffprobe and these Python dependencies are required. The existing live Railway image has not been updated.

```sh
python -m pip install -r apps/worker/reconstruction/alex-v16/requirements.txt
python -m unittest discover -s apps/worker/reconstruction/alex-v16 -p 'test_*.py' -v
python apps/worker/reconstruction/alex-v16/render.py --input BASE.mp4 --plan PLAN.json --output NEW_OUTPUT.mp4
```

The compositor takes an **already edited base timeline**, not an automatic
editorial cut plan. It replaces only explicitly planned graphic intervals; it
does not create new cuts or claim autonomous semantic/phonetic analysis. New-rush
plans require confirmed timed words. Unknown words fail closed instead of being
invented. The caption adapter was exercised on a real raw rush; it is reconstructed code,
not the original V11 subtitle generator.

For reconstruction comparison ONLY, use a private plan with
`purpose: "reference-reconstruction-qa"`, the exact input `referenceSha256`, and
`--reference-qa`. This mode is restricted to the measured 910×512/30fps reference.
It preserves the existing bottom 72-pixel subtitle strip during the graphic
scenes. The other 440 pixels are regenerated from drawing primitives. The
existing footage, captions, cuts and AAC audio are inherited from that base.
**A full MP4 in this mode proves reconstruction composition, not a new-rush
automatic Alex V16 montage.**

The private reference plan and videos are not committed. They contain historical
wording/timings and must never become a hardcoded new-rush default. Each scene
plan includes `kind`, `start`, `end`, `text` (`chapter`, `title`, `labels`,
`conclusion`, paired `symbols` for question/value), and `cues`. Cue offsets are
relative to the scene start. A chain supplies three `nodeStarts`, two
`arrowStarts`, `arrowDuration`, `calloutStart`, `calloutDuration`; question/value
supply `rightHighlight`, `arrowStart` and the same durations/callout fields.

Normal plans use `purpose: "new-rush"`, `wordVerification: "human-confirmed"`
and `words: [{"text": "...", "start": 0.0, "end": 0.2}]`. These verification
flags must originate from a real review, never be synthesized by a caller to
bypass the check. This CLI is not an exposed server endpoint.

Output creation is atomic, refuses overwrites, validates dimensions, duration,
track counts/codecs and decodes the complete MP4. Video is H.264/yuv420p with
faststart; AAC is stream copied. Other original audio codecs are encoded to AAC,
without voice synthesis, pitch changes or audio filters. Native dimensions are
kept; rotated/VFR inputs fail explicitly pending the existing normalization
pipeline. Portrait drawing and decoded captions have also been inspected on the real
27-second source; physical iPhone playback is not claimed.

## Compare real exports

```sh
python apps/worker/reconstruction/alex-v16/compare.py --reference MASTER.mp4 --result NEW_OUTPUT.mp4 --plan PRIVATE_PLAN.json --directory PRIVATE_QA
```

The comparator decodes both full videos, checks equal frame counts, compares
each of the three graphic regions and extracts the AAC bitstreams for hashing.
It reports foreground dark/blue mask IoU and RGB error, and saves side-by-side
stills. These measurements are **not** a commercial quality score and do not
certify spoken words, physical Safari playback or user approval. Store generated
reports containing private source details, images and videos outside public Git.
