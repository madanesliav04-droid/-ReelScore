-- Clip+ shared SaaS core

alter table public.media_assets
  drop constraint if exists media_assets_module_check;
alter table public.media_assets
  add constraint media_assets_module_check
  check (module in ('shared','viralplus','editplus','clipplus'));

alter table public.media_assets
  drop constraint if exists media_assets_kind_check;
alter table public.media_assets
  add constraint media_assets_kind_check
  check (kind in ('source','render','clip','broll','thumbnail','audio'));

alter table public.processing_jobs
  drop constraint if exists processing_jobs_kind_check;
alter table public.processing_jobs
  add constraint processing_jobs_kind_check
  check (kind in ('viral_analysis','edit_render','clip_generate'));
alter table public.processing_jobs
  alter column video_id drop not null;

alter table public.credit_ledger
  drop constraint if exists credit_ledger_module_check;
alter table public.credit_ledger
  add constraint credit_ledger_module_check
  check (module in ('viralplus','editplus','clipplus','shared'));

create table if not exists public.clip_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_video_id uuid references public.media_assets(id) on delete set null,
  source_url text,
  source_platform text not null default 'unknown'
    check (source_platform in ('youtube','tiktok','instagram','direct','upload','unknown')),
  title text,
  requested_clip_count smallint not null default 5 check (requested_clip_count between 1 and 12),
  min_duration_sec smallint not null default 20 check (min_duration_sec between 8 and 120),
  max_duration_sec smallint not null default 60 check (max_duration_sec between 12 and 180),
  status text not null default 'queued'
    check (status in ('queued','importing','analyzing','rendering','completed','failed','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_video_id is not null or source_url is not null),
  check (max_duration_sec >= min_duration_sec)
);

create index if not exists clip_projects_user_created_idx
  on public.clip_projects(user_id, created_at desc);

alter table public.clip_projects enable row level security;
revoke all on public.clip_projects from anon, authenticated;
grant select on public.clip_projects to authenticated;

drop policy if exists clip_projects_select_own on public.clip_projects;
create policy clip_projects_select_own
on public.clip_projects for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create table if not exists public.clip_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.clip_projects(id) on delete cascade,
  job_id uuid references public.processing_jobs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  output_video_id uuid not null references public.media_assets(id) on delete restrict,
  rank smallint not null check (rank between 1 and 50),
  viral_score smallint check (viral_score is null or viral_score between 0 and 100),
  title text,
  hook text,
  rationale text,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  status text not null default 'ready' check (status in ('ready','deleted','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, rank)
);

create index if not exists clip_outputs_user_created_idx
  on public.clip_outputs(user_id, created_at desc);
create index if not exists clip_outputs_project_rank_idx
  on public.clip_outputs(project_id, rank);

alter table public.clip_outputs enable row level security;
revoke all on public.clip_outputs from anon, authenticated;
grant select on public.clip_outputs to authenticated;

drop policy if exists clip_outputs_select_own on public.clip_outputs;
create policy clip_outputs_select_own
on public.clip_outputs for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

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
$$;

revoke all on function public.create_processing_job(text,uuid,jsonb,text) from public, anon;
grant execute on function public.create_processing_job(text,uuid,jsonb,text) to authenticated;
