# Alex V16: isolated synthetic Actions test — 2026-11-04

Successful execution: https://github.com/madanesliav04-droid/-ReelScore/actions/runs/41860782734
Source commit: `9084448d49aac945640205b10657fe7c5e87ea0c`.

This is a CI rendering proof, not an application host, production deployment,
visual reference certification, or a private-iPhone end-to-end test.

## Actual results

- Generated, non-personal 26.048980-second landscape source, 640 × 360.
- Real local Whisper transcription, existing Alex planner, three infographic scenes,
  376 generated infographic frames, captions and FFmpeg export. No master input.
- Two measured inter-sentence silence cuts; output 23.666984 seconds, 640 × 360.
- H.264/AAC MP4: 1,626,590 bytes; SHA-256
  `be135596245d9d0636dfe967e6dee52d65f461a3914e772129c2ef80a87fc675`.
- Full decode passed on runner and again after encrypted recovery.
- Exactly one AAC audio track, bit-identical to the prepared source audio;
  audio packet timestamps unchanged, maximum difference zero.
- Audio/video end-duration difference 0.026984 seconds. This is a technical
  container check, not a perceptual word alignment certification.
- 61 timestamped words, positive nonoverlapping windows within the output.
  No automatically low-confidence entries reported, but `reviewRequired=true`:
  a confidence threshold is not human validation. No corrected transcript injected.
- Recovered MP4 played locally in Chromium at a 390 × 844 touch viewport:
  readyState 4, currentTime advanced beyond 0.5 seconds, no media error.
  Safari/WebKit and a physical iPhone were NOT tested.
- Three sampled infographic frames inspected locally. No comparison with an original
  approved master was performed. No fidelity or product score is assigned.

## Resources

Measured rendering/transcription process group (excludes runner provisioning,
package and public model downloads): elapsed 25.280 seconds, CPU 47.451 CPU-seconds,
187.70% average CPU (100% = one core), sampled CPU peak 386.46%.
Sampled aggregate process-group RSS peak 918,749,184 bytes (~876 MiB), maximum
single-process RSS 802,308,096 bytes. Summed RSS may count shared pages more than
once; this is not exact cgroup memory accounting. No production capacity claim.

## Scope, privacy and costs

Only the isolated `codex/socialplus-actions-free-worker-20261027` branch changed.
Existing Alex artistic implementation and the five other engines are unchanged.
Private media and keys are absent from Git. No deployment, merge, Supabase,
Gemini, R2, Railway or Oracle processing. Standard ubuntu-24.04 public-repository
runner, read-only token and explicit manual workflow dispatch only. No artifact
or Actions cache is uploaded. GitHub documents this standard public-runner compute
as free: https://docs.github.com/en/billing/concepts/product-billing/github-actions
The connection cannot read account billing (HTTP 403); no balance or invoice claim.

The result ZIP is encrypted with OpenSSL CMS AES-256-CBC to a disposable RSA-3072
public certificate before appearing in logs. Only the public certificate is in Git;
the private key remains outside the repository in the private task workspace.
Ciphertext integrity is verified before local decryption. This bounded test does
not offer permanent storage or a general public video service.

First two attempts failed honestly at ALEX_SCENE_EVIDENCE_REQUIRED because robotic
synthetic speech was poorly transcribed. No model rule was weakened. After switching
only the test fixture to a clearer local synthetic voice, the same planner succeeded.

## Synthetic voice attribution

Piper test-only synthesizer, version 1.3.0. SIWIS medium French model from
rhasspy/piper-voices, pinned revision
`e7229f7d33a10e145e109b886d661984201ac3c4`. Dataset licence CC-BY 4.0, source:
https://datashare.is.ed.ac.uk/handle/10283/2353 . Model card:
https://huggingface.co/rhasspy/piper-voices/blob/e7229f7d33a10e145e109b886d661984201ac3c4/fr/fr_FR/siwis/medium/MODEL_CARD
Public weight/config/card hashes are verified by the fixture generator. The voice
is synthetic and used only to create a non-sensitive test input; no user voice
is replaced in the engine. No new TTS dependency is added to the production engine.

## Remaining blockers

No always-on authenticated HTTPS video backend is provisioned. The current
Vercel preview must not be advertised as supporting this cloud-rendering path.
User import/authentication, private durable projects and rendering initiated from
Safari still require an authorized compatible backend and controlled storage.
Transcription accuracy, artistic fidelity and physical iPhone playback require
separate validation. This low-resolution synthetic test does not prove arbitrary
rush support, professional 1080p quality or commercialization readiness.
