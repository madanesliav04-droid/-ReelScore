-- Process real client jobs before internal/low-priority work.
create or replace function public.worker_claim_processing_job(
  p_worker_id text,
  p_kinds text[] default array['viral_analysis'::text,'edit_render'::text]
)
returns setof public.processing_jobs
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  picked public.processing_jobs%rowtype;
begin
  select * into picked
  from public.processing_jobs j
  where j.kind = any(p_kinds)
    and j.next_attempt_at <= now()
    and (
      j.status='queued'
      or (
        j.status='processing'
        and coalesce(j.heartbeat_at,j.locked_at,j.updated_at) < now()-interval '3 minutes'
      )
    )
    and j.retry_count <= j.max_retries
  order by j.priority desc, j.created_at asc
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
  values(
    picked.id,picked.user_id,'processing',picked.progress,'Worker assigné',
    jsonb_build_object('worker_id',p_worker_id)
  );

  return next picked;
end;
$function$;

create index if not exists clip_outputs_output_video_id_idx
  on public.clip_outputs(output_video_id);

create index if not exists clip_projects_source_video_id_idx
  on public.clip_projects(source_video_id);
