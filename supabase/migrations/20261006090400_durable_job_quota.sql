-- Make Viral+ quota consumption atomic with durable job creation.
alter table public.processing_jobs
  add column if not exists credit_charged boolean not null default false,
  add column if not exists credit_refunded boolean not null default false;

create or replace function public.create_processing_job(
  p_kind text,
  p_video_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.processing_jobs%rowtype;
  created public.processing_jobs%rowtype;
  profile_row public.viralplus_profiles%rowtype;
  charge boolean := false;
  free_limit integer := 20;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('viral_analysis','edit_render') then raise exception 'invalid_job_kind'; end if;

  if not exists (
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
  )
  values(
    uid,p_kind,p_video_id,'queued',0,coalesce(p_payload,'{}'::jsonb),p_idempotency_key,charge
  )
  returning * into created;

  insert into public.job_events(job_id,user_id,status,progress,message)
  values(created.id,uid,'queued',0,'Job mis en file');

  return created;
end;
$$;

revoke all on function public.create_processing_job(text,uuid,jsonb,text) from public, anon;
grant execute on function public.create_processing_job(text,uuid,jsonb,text) to authenticated;

create or replace function public.worker_refund_job_credit(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.processing_jobs%rowtype;
begin
  select * into j
  from public.processing_jobs
  where id=p_job_id
  for update;

  if not found or not j.credit_charged or j.credit_refunded then
    return false;
  end if;

  update public.viralplus_profiles
  set analyses_used=greatest(analyses_used-1,0),
      updated_at=now()
  where user_id=j.user_id;

  update public.processing_jobs
  set credit_refunded=true,
      updated_at=now()
  where id=j.id;

  return true;
end;
$$;

revoke all on function public.worker_refund_job_credit(uuid) from public, anon, authenticated;
grant execute on function public.worker_refund_job_credit(uuid) to service_role;
