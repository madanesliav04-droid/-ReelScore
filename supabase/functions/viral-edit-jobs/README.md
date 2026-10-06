# viral-edit-jobs Edge Function

Control-plane API for Viral+ / Edit+.

It never accepts video bytes. The browser uploads directly to private Supabase Storage and this function only receives metadata / storage path / IDs.

Routes:
- `POST /media` register an already-uploaded private object.
- `POST /analysis` register/reuse media and enqueue a durable Viral+ job.
- `POST /edit` create an Edit+ project and enqueue a render job.
- `GET /jobs/:id` read the real persisted status/progress/result.
- `POST /jobs/:id/retry` retry an eligible failed job.

Deploy with JWT verification enabled. `SUPABASE_SERVICE_ROLE_KEY` stays server-side.
