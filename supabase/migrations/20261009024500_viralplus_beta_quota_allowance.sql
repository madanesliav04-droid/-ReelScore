-- Preserve the standard 20-analyses/month allowance; grant an explicit,
-- capped testing allowance to the existing saturated QA account only.
ALTER TABLE public.viralplus_profiles ADD COLUMN IF NOT EXISTS analysis_limit integer NOT NULL DEFAULT 20;
ALTER TABLE public.viralplus_profiles
  ADD CONSTRAINT viralplus_profiles_analysis_limit_check CHECK (analysis_limit BETWEEN 1 AND 200);
UPDATE public.viralplus_profiles
  SET analysis_limit=200, updated_at=now()
  WHERE analyses_used>=20 AND analysis_limit=20;
CREATE OR REPLACE FUNCTION public.create_processing_job(p_kind text, p_video_id uuid, p_payload jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS processing_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  existing public.processing_jobs%rowtype;
  created public.processing_jobs%rowtype;
  profile_row public.viralplus_profiles%rowtype;
  charge boolean := false;
  free_limit integer := 20;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('viral_analysis','edit_render','clip_generate') then raise exception 'invalid_job_kind'; end if;

  if p_kind in ('viral_analysis','edit_render') and p_video_id is null then
    raise exception 'video_required';
  end if;

  if p_video_id is not null and not exists (
    select 1 from public.media_assets m
    where m.id=p_video_id
      and m.user_id=uid
      and m.deleted_at is null
  ) then
    raise exception 'video_access_denied';
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.processing_jobs
    where user_id=uid and idempotency_key=p_idempotency_key
    order by created_at desc
    limit 1;
    if found then return existing; end if;
  end if;

  if p_kind='viral_analysis' then
    insert into public.viralplus_profiles(user_id)
    values(uid)
    on conflict (user_id) do nothing;

    select * into profile_row
    from public.viralplus_profiles
    where user_id=uid
    for update;

    if profile_row.period_start < date_trunc('month',now()) then
      update public.viralplus_profiles
      set analyses_used=0,
          period_start=date_trunc('month',now()),
          updated_at=now()
      where user_id=uid
      returning * into profile_row;
    end if;

    -- Per-account allowance: beta testing does not exhaust the customer-facing free tier.
    free_limit := greatest(1,least(200,profile_row.analysis_limit));

    if profile_row.analyses_used >= free_limit then
      raise exception 'quota_exhausted';
    end if;

    update public.viralplus_profiles
    set analyses_used=analyses_used+1,
        updated_at=now()
    where user_id=uid;
    charge := true;
  end if;

  insert into public.processing_jobs(
    user_id,kind,video_id,status,progress,payload,idempotency_key,credit_charged
  ) values (
    uid,p_kind,p_video_id,'queued',0,coalesce(p_payload,'{}'::jsonb),p_idempotency_key,charge
  ) returning * into created;

  insert into public.job_events(job_id,user_id,status,progress,message)
  values(created.id,uid,'queued',0,'Job mis en file');

  return created;
end;
$function$
