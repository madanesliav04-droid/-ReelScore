-- Durable queue API for Viral+ / Edit+.
-- Clients can only enqueue jobs for media they own. Workers claim atomically with SKIP LOCKED.

revoke insert on public.processing_jobs from authenticated;
drop policy if exists processing_jobs_insert_own on public.processing_jobs;

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
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('viral_analysis','edit_render') then raise exception 'invalid_job_kind'; end if;
  if not exists (
    select 1 from public.media_assets m
    where m.id=p_video_id and m.user_id=uid and m.deleted_at is null
  ) then raise exception 'video_access_denied'; end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.processing_jobs
    where user_id=uid and idempotency_key=p_idempotency_key
    order by created_at desc limit 1;
    if found then return existing; end if;
  end if;

  insert into public.processing_jobs(user_id,kind,video_id,status,progress,payload,idempotency_key)
  values(uid,p_kind,p_video_id,'queued',0,coalesce(p_payload,'{}'::jsonb),p_idempotency_key)
  returning * into created;

  insert into public.job_events(job_id,user_id,status,progress,message)
  values(created.id,uid,'queued',0,'Job mis en file');

  return created;
end;
$$;

revoke all on function public.create_processing_job(text,uuid,jsonb,text) from public, anon;
grant execute on function public.create_processing_job(text,uuid,jsonb,text) to authenticated;

create or replace function public.worker_claim_processing_job(
  p_worker_id text,
  p_kinds text[] default array['viral_analysis','edit_render']::text[]
)
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  picked public.processing_jobs%rowtype;
begin
  select * into picked
  from public.processing_jobs j
  where j.kind = any(p_kinds)
    and j.next_attempt_at <= now()
    and (
      j.status='queued'
      or (j.status='processing' and coalesce(j.heartbeat_at,j.locked_at,j.updated_at) < now()-interval '3 minutes')
    )
    and j.retry_count <= j.max_retries
  order by j.priority asc, j.created_at asc
  for update skip locked
  limit 1;

  if not found then return; end if;

  update public.processing_jobs
  set status='processing',
      progress=greatest(progress,1),
      stage='Worker assigné',
      locked_at=now(),
      locked_by=p_worker_id,
      heartbeat_at=now(),
      started_at=coalesce(started_at,now()),
      updated_at=now(),
      error_code=null,
      error=null
  where id=picked.id
  returning * into picked;

  insert into public.job_events(job_id,user_id,status,progress,message,details)
  values(picked.id,picked.user_id,'processing',picked.progress,'Worker assigné',jsonb_build_object('worker_id',p_worker_id));

  return next picked;
end;
$$;

revoke all on function public.worker_claim_processing_job(text,text[]) from public, anon, authenticated;
grant execute on function public.worker_claim_processing_job(text,text[]) to service_role;

drop policy if exists "viralplus video update own folder" on storage.objects;
create policy "viralplus video update own folder"
on storage.objects for update
to authenticated
using (
  bucket_id='viralplus-videos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='viralplus-videos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
