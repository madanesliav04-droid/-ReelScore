-- Content-equivalent uploads need a durable cache key independent of MP4/MOV metadata.
ALTER TABLE public.viralplus_analyses
  ADD COLUMN IF NOT EXISTS source_fingerprint text;
CREATE INDEX IF NOT EXISTS viralplus_analyses_fingerprint_cache_idx
  ON public.viralplus_analyses(user_id,score_version,source_fingerprint,created_at DESC)
  WHERE source_fingerprint IS NOT NULL;
