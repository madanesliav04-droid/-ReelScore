# Three Alex V16 fullscreen infographics — reconstruction

This is newly authored reconstruction code from the approved V16 picture, **not
the recovered V11 source**. The four historical Alex modules and all six models
remain unchanged. This module is deliberately isolated and not enabled in the
web worker's model selector until fidelity and a new-rush flow are validated.

`scenes.py` draws only the question/value/chain compositions, with explicit text
and output-timeline cue parameters. It never reads a master, source image or
reference audio. Existing licensed Inter subsets are reused unchanged; their
hashes and OFL notice are in `fonts/`. Their exact identity with the old master
font is not established. No stock insert or generic artistic preset is used.

## Run locally

Python 3.12+, FFmpeg/ffprobe and these Python dependencies are required. This
isolated module is **not installed in the current Railway Docker image**.

```sh
python -m pip install -r apps/worker/reconstruction/alex-v16/requirements.txt
python -m unittest discover -s apps/worker/reconstruction/alex-v16 -p 'test_*.py' -v
python apps/worker/reconstruction/alex-v16/render.py --input BASE.mp4 --plan PLAN.json --output NEW_OUTPUT.mp4
```

The compositor takes an **already edited base timeline**, not an automatic
editorial cut plan. It replaces only explicitly planned graphic intervals; it
does not create new cuts or claim autonomous semantic/phonetic analysis. New-rush
plans require confirmed timed words. Unknown words fail closed instead of being
invented. The current ordinary-plan caption adapter is unvalidated on a real
new rush; it is not the original V11 subtitle generator.

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
pipeline. Portrait canvas drawing is covered only by unit tests, not visual QA.

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
