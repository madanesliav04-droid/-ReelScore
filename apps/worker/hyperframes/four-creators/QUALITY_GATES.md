# QA gates — no commercial approval without all passing

- Original audio identity (if no cuts: exact stream; if cuts: source-linked voice and no unintended dubbing or pitch changes).
- Native aspect ratio. No portrait white bars on a landscape source.
- All cuts align to words/intent. Map any source-timed animations onto the output timeline **after** cuts.
- No factual onscreen text without transcript or evidence. Editorial paraphrases are labeled as such in the scene ledger and never formatted as fabricated direct quotations.
- No fake testimonials, price numbers or engagement metrics. No B-roll without relevant sentence and media license.
- Valid safe zone proof from faces, hands, props and captions across motion, not static region assumptions.
- `hyperframes lint`, `hyperframes check` when available, real video render and full FFmpeg decode. Inspect smartphone readability in generated contact sheet and real playback.
- Three dissimilar test inputs required per preset before full launch: facecam landscape, portrait mobile, moving hands/board.
- Different decisions across the 4 presets; changing colors is not sufficient.

Scoring editorial estimate / 100: narrative correspondence 25; reference fidelity validated on primary videos 20; composition 15; cuts 15; motion 10; sound 10; E2E robustness 5. 100/100 is a target, never a claim based only on a render succeeding.
