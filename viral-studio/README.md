# Viral Studio

Next.js frontend for the Viral Studio suite.

## Modules
- Viral+: deterministic video analysis jobs
- Edit+: automated edit/render jobs
- Clip+: long-form URL to short-form clip jobs

## Existing backend reused
- Supabase Auth + private Storage
- media_assets / processing_jobs
- viralplus_analyses
- edit_projects / edit_timelines / edit_exports
- clip_projects / clip_outputs
- billing_subscriptions / credit_ledger
- Supabase Edge Functions: viral-edit-jobs, clip-jobs
- Railway workers: video-worker, clip-worker

Large uploads use the Supabase direct Storage TUS endpoint; files are never proxied through the Next.js server.
