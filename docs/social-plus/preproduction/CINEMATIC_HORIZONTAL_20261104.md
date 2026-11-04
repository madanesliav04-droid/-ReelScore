# Horizontal Cinematic V7 beta — 2026-11-04

No artistic engine changed. Existing autonomous V7 pipeline is connected through
an explicit default-off `SOCIALPLUS_CINEMATIC_V7_PIPELINE` flag. Server refuses
legacy/generic plans without `cinematic-v7-autonomous-1`. UI catalog labels the
connected model beta, transcription/fidelity unverified. Other model gates unchanged.

Real spoken horizontal rush: 47.1 s, native 910 × 512. Fresh local transcription,
four existing Cinematic graphic sequences, measured pause cut, H.264/AAC export
45.637 s / 5,588,799 bytes. No native-format change or invented words confirmed.

Passed in isolated local HTTPS app: owner MFA login, actual browser import,
Cinematic selection/preparation, real queued rendering, preview playback, browser
download with matching hash, full decode and completed-project retrieval after
server restart. Output matches the separately verified CLI export byte for byte.
10 targeted admission/planner tests passed. Test harness now reads the plan before
completed-job privacy cleanup erases descriptors; initial harness assertions against
erased data failed, were corrected, and the complete test passed.

Six source/output audio comparisons before/after the cut: correlation >0.9994,
measured lag 0 ms at sampled positions. No phonetic word-perfect certification.
`strace -f -e trace=openat` during the UI render found no old V6/V7 media or timing
file reads. Existing pure drawing source code is reused and permitted.

Full UI test including file-I/O tracing: 71.397 s, CPU 102.439 CPU-seconds, sampled
process-group RSS max 769,544,192 bytes (~734 MiB). Not an OVH benchmark or exact
kernel RAM peak. Private project snapshot at completion: 7,973,008 bytes.

Limits: 20 transcription review entries (including 4 multiword timing groups in the
CLI review), no human listening/visual reference approval, physical Safari not tested.
No public backend deployed. All source media, transcripts, traces and MP4s remain
outside GitHub. No paid services, no deployment, no merge, no production changes.

Leila was not presented as operational: its original V53 script depends on fixed
historical cuts, V44 subtitle pixels and V49 media. A partial component preview is
not a substitute for its approved complete model.
