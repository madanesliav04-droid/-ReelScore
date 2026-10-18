# Edit+ V10 | Commercial launch gate status (2026-10-17)

## Completed code changes
- Gemini interactions `word_info` is the **only acceptable source** for timed V10 motion; sentence interpolation is blocked. Mapped after `timeline.keepRanges` with strict sorting and duration checks, including the case where a word would straddle an edit cut. 
- New `social-kinetic-v10-word-plan.js` builds responsive, transcript-grounded HyperFrames/GSAP captions. Editorial metrics and messages are accepted only when a literal spoken phrase exists; no invented user results.
- New `social-kinetic-v10-runtime.js` uses the **already preprocessed** input: no duplicated cuts. Original audio track preserved, source aspect ratio native.
- `index.js` stages V10 from the existing `social_kinetic` style only when `ENABLE_SOCIAL_KINETIC_V10=staging` and `ENABLE_HYPERFRAMES_RENDER=true`. Disabled on public builds; unavailable safe-zone proof causes explicit blocked error.
- V10 commercial QA now accepts **mono preserved as mono** and **stereo preserved as stereo**; changed channels fail. Explicit E2E audio review remains required.
- Tests cover word provider evidence, source-to-cut mapping, overlapping/unordered cuts, portrait geometry, absent frame proofs, unspoken metric/chat, and mono/stereo fidelity.

## Measurements and unresolved real-world evidence
- Authentic reference screenshot vs prior V10 MP4 compared in five phases; reference capture audio -12.4 LUFS / peak -0.9 dBFS; prior V10 MP4 -16.8 LUFS / -1.3 dBFS. This is a capture-vs-master mismatch, **not permission** to master blindly at -12 LUFS.
- Three locally available physical source files decode and re-export in native geometry with original audio channels. But two of the horizontal files are essentially the SAME scene (mean frame absolute error at 12s is ~1.36/255), so there are only TWO independently different scenarios. Historical portrait tableau original 8191eed... (43.73s) has not been recovered as runnable file in this workspace.
- Prior V10 demo captions were derived from a 9-segment, 154-word real transcript but intra-segment word times were **estimated**, not provider-stamped. Their rendered MP4 is **not** commercial-certified.
- No independent whole-video face+hand+writing proof for the two portrait situations, human SFX listening comparison, or user sign-off exists. Running CI with fabricated mocks is NOT three real final edits.
- Site production wiring/real user mobile checkout remains unverified. V10 should remain disabled publicly until 3 distinct source E2E exports pass and the user approves the result.

**Release verdict:** Blocked, PR stays draft; no production enablement or '100/100' claims. Next run: use source with actual Gemini word_info + independent source-frame sampler -> V10 plan -> HyperFrames render -> FFmpeg audio/frame QA -> real reference comparison -> human listen -> user approval.
