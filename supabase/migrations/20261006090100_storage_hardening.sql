-- Remove the obsolete anonymous beta upload path.
-- The production path is authenticated direct-to-private-storage under <auth.uid()>/...
drop policy if exists "beta direct uploads" on storage.objects;

-- Legacy beta job table is not part of the production job system.
revoke all on public.viralplus_beta_jobs from anon, authenticated;

-- SECURITY DEFINER quota RPCs intentionally authenticate with auth.uid().
-- Do not expose them to anonymous callers.
revoke execute on function public.viralplus_consume_credit() from public, anon;
revoke execute on function public.viralplus_get_entitlement() from public, anon;
revoke execute on function public.viralplus_refund_credit() from public, anon;
grant execute on function public.viralplus_consume_credit() to authenticated;
grant execute on function public.viralplus_get_entitlement() to authenticated;
grant execute on function public.viralplus_refund_credit() to authenticated;
