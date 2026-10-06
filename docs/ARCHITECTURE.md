# Viral+ / Edit+ — architecture cible

## Source of truth

GitHub owns application code, migrations and worker code. Supabase is the shared data plane. A builder may accelerate UI work, but no critical source code may exist only inside a builder.

## Shared media flow

```
mobile/web client
  -> authenticated TUS upload
  -> private Supabase Storage (user-scoped path)
  -> media_assets row
  -> processing_jobs row
  -> Railway worker claims durable job
  -> media processing / AI
  -> result persisted
  -> UI reads real status/progress
```

Large video bytes never travel inside a JSON payload, serverless invocation payload, or database row.

## Viral+ analysis job

The worker processes a `viral_analysis` job using measured signals plus multimodal reasoning:

1. ffprobe: codec, duration, dimensions, FPS, audio stream.
2. FFmpeg: silence windows, loudness, cut/scene candidates, representative frames.
3. Timestamped transcription.
4. Visible-text/caption inspection from sampled frames.
5. Business layer normalizes measurable features.
6. Gemini receives the video/reference material plus normalized evidence and produces structured editorial reasoning.
7. Viral+ computes the final score deterministically from normalized criteria.
8. Report + timeline + evidence are persisted before the job becomes `completed`.

A model response is evidence for semantic judgments, not the sole scoring engine.

## Edit+ render job

```
source video
  -> transcript + silence map + Viral+ findings
  -> edit planner
  -> versioned timeline JSON
  -> FFmpeg preprocessing
  -> Remotion composition
  -> FFmpeg final encode
  -> private Storage
  -> edit_exports
```

The AI produces decisions. It does not produce an opaque final video.

Initial style IDs:
- `creator_clean`
- `codie`
- `business_viral`
- `podcast_authority`

Initial caption preset IDs:
- `modern_bold`
- `minimal`
- `creator`
- `karaoke`
- `authority`
- `ugc`

## Timeline contract

```json
{
  "version": 1,
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "segments": [
    {
      "sourceStartMs": 8400,
      "sourceEndMs": 11800,
      "crop": "close",
      "captionPreset": "modern_bold",
      "broll": {
        "mode": "library",
        "query": "entrepreneur working laptop"
      },
      "transition": "cut",
      "reason": "Increase visual change on the proof sentence"
    }
  ]
}
```

## Job reliability

Every job has:
- persistent status and progress,
- retry count and next attempt time,
- lock owner + heartbeat,
- idempotency key,
- explicit error code/message,
- persisted result,
- append-only job events.

The client must display real job state. Indeterminate UI is allowed only while the backend has no finer-grained progress; invented percentages are not.

## Security

- Storage remains private.
- Object path begins with the authenticated user's UUID.
- Browser only receives the Supabase publishable key.
- Service-role, Stripe secret, Gemini key and worker DB credentials stay server-side.
- RLS is required on every exposed user-data table.
- Views exposed to clients use `security_invoker = true`.
- Worker validates job ownership/input before processing.

## Deployment split

- Web: current GitHub Pages remains valid until Vercel is connected and migration is justified.
- Auth/Postgres/Storage: Supabase.
- Durable video worker: Railway.
- Billing: Stripe.
- Product analytics: PostHog.
- Transactional email: Resend.
- Edit+ renderer: Railway worker with Remotion + FFmpeg.

## Migration order

1. Apply `20261006090000_shared_viral_edit_core.sql`.
2. Verify RLS and grants.
3. Apply `20261006090100_storage_hardening.sql`.
4. Deploy job API.
5. Deploy Railway worker.
6. Switch frontend analysis from synchronous request to durable job polling/realtime.
7. Retire the legacy `viralplus-beta`, `viralplus-upload-ticket` and `viralplus-process` endpoints.
