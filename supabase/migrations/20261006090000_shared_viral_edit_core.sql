-- Viral+ / Edit+ shared core
-- Source-of-truth migration. Apply through Supabase migration tooling after write access is available.

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null default 'shared' check (module in ('shared','viralplus','editplus')),
  kind text not null default 'source' check (kind in ('source','render','broll','thumbnail','audio')),
  storage_bucket text not null default 'viralplus-videos',
  storage_path text not null,
  original_name text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded'
    check (status in ('uploading','uploaded','processing','ready','failed','deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path)
);

create index if not exists media_assets_user_created_idx
  on public.media_assets(user_id, created_at desc);
create index if not exists media_assets_sha_idx
  on public.media_assets(user_id, sha256)
  where sha256 is not null;

alter table public.media_assets enable row level security;
revoke all on public.media_assets from anon, authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;

create policy media_assets_select_own
on public.media_assets for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy media_assets_insert_own
on public.media_assets for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy media_assets_update_own
on public.media_assets for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy media_assets_delete_own
on public.media_assets for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);


create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('viral_analysis','edit_render')),
  video_id uuid not null references public.media_assets(id) on delete cascade,
  output_video_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'queued'
    check (status in (
      'uploaded','queued','processing','transcribing','analyzing',
      'generating_report','planning','rendering','encoding',
      'completed','failed','cancelled'
    )),
  progress smallint not null default 0 check (progress between 0 and 100),
  stage text,
  priority smallint not null default 100 check (priority between 0 and 1000),
  idempotency_key text,
  retry_count smallint not null default 0 check (retry_count >= 0),
  max_retries smallint not null default 3 check (max_retries between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  heartbeat_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists processing_jobs_idempotency_idx
  on public.processing_jobs(user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists processing_jobs_worker_queue_idx
  on public.processing_jobs(priority, next_attempt_at, created_at)
  where status in ('queued','failed');
create index if not exists processing_jobs_user_created_idx
  on public.processing_jobs(user_id, created_at desc);
create index if not exists processing_jobs_video_idx
  on public.processing_jobs(video_id, created_at desc);

alter table public.processing_jobs enable row level security;
revoke all on public.processing_jobs from anon, authenticated;
grant select, insert on public.processing_jobs to authenticated;

create policy processing_jobs_select_own
on public.processing_jobs for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy processing_jobs_insert_own
on public.processing_jobs for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.media_assets m
    where m.id = video_id
      and m.user_id = (select auth.uid())
      and m.deleted_at is null
  )
);


create table if not exists public.job_events (
  id bigint generated by default as identity primary key,
  job_id uuid not null references public.processing_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  progress smallint check (progress is null or progress between 0 and 100),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_events_job_created_idx
  on public.job_events(job_id, created_at);
create index if not exists job_events_user_created_idx
  on public.job_events(user_id, created_at desc);

alter table public.job_events enable row level security;
revoke all on public.job_events from anon, authenticated;
grant select on public.job_events to authenticated;

create policy job_events_select_own
on public.job_events for select to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.processing_jobs j
    where j.id = job_id
      and j.user_id = (select auth.uid())
  )
);


create table if not exists public.edit_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_video_id uuid not null references public.media_assets(id) on delete cascade,
  source_analysis_id uuid references public.viralplus_analyses(id) on delete set null,
  style text not null default 'creator_clean'
    check (style in ('creator_clean','codie','business_viral','podcast_authority')),
  caption_preset text not null default 'modern_bold'
    check (caption_preset in ('modern_bold','minimal','creator','karaoke','authority','ugc')),
  status text not null default 'draft'
    check (status in ('draft','planning','ready','rendering','completed','failed','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists edit_projects_user_created_idx
  on public.edit_projects(user_id, created_at desc);

alter table public.edit_projects enable row level security;
revoke all on public.edit_projects from anon, authenticated;
grant select, insert, update on public.edit_projects to authenticated;

create policy edit_projects_select_own
on public.edit_projects for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy edit_projects_insert_own
on public.edit_projects for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.media_assets m
    where m.id = source_video_id
      and m.user_id = (select auth.uid())
  )
);

create policy edit_projects_update_own
on public.edit_projects for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);


create table if not exists public.edit_timelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.edit_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  timeline_json jsonb not null,
  decision_model text,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists edit_timelines_user_created_idx
  on public.edit_timelines(user_id, created_at desc);

alter table public.edit_timelines enable row level security;
revoke all on public.edit_timelines from anon, authenticated;
grant select on public.edit_timelines to authenticated;

create policy edit_timelines_select_own
on public.edit_timelines for select to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.edit_projects p
    where p.id = project_id
      and p.user_id = (select auth.uid())
  )
);


create table if not exists public.edit_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.edit_projects(id) on delete cascade,
  job_id uuid references public.processing_jobs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  output_video_id uuid not null references public.media_assets(id) on delete restrict,
  preset text not null default '1080x1920',
  status text not null default 'ready'
    check (status in ('ready','expired','deleted')),
  created_at timestamptz not null default now()
);

create index if not exists edit_exports_user_created_idx
  on public.edit_exports(user_id, created_at desc);

alter table public.edit_exports enable row level security;
revoke all on public.edit_exports from anon, authenticated;
grant select on public.edit_exports to authenticated;

create policy edit_exports_select_own
on public.edit_exports for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);


create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  plan text not null default 'free' check (plan in ('free','creator','pro')),
  status text not null default 'inactive'
    check (status in ('inactive','trialing','active','past_due','canceled','unpaid','paused')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_subscriptions_user_provider_idx
  on public.billing_subscriptions(user_id, provider);
create unique index if not exists billing_subscriptions_provider_sub_idx
  on public.billing_subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

alter table public.billing_subscriptions enable row level security;
revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;

create policy billing_subscriptions_select_own
on public.billing_subscriptions for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);


create table if not exists public.credit_ledger (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (module in ('viralplus','editplus','shared')),
  units integer not null check (units <> 0),
  reason text not null,
  idempotency_key text,
  job_id uuid references public.processing_jobs(id) on delete set null,
  external_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_idempotency_idx
  on public.credit_ledger(user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger(user_id, created_at desc);

alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to authenticated;

create policy credit_ledger_select_own
on public.credit_ledger for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);


alter table public.viralplus_analyses
  add column if not exists video_id uuid references public.media_assets(id) on delete set null,
  add column if not exists job_id uuid references public.processing_jobs(id) on delete set null;

create index if not exists viralplus_analyses_video_id_idx
  on public.viralplus_analyses(video_id)
  where video_id is not null;
create unique index if not exists viralplus_analyses_job_id_idx
  on public.viralplus_analyses(job_id)
  where job_id is not null;

create or replace view public.analysis_jobs
with (security_invoker = true)
as
select
  id,user_id,video_id,output_video_id,status,progress,stage,
  created_at,started_at,completed_at,error,retry_count,max_retries,
  next_attempt_at,locked_at,locked_by,heartbeat_at,payload,result
from public.processing_jobs
where kind='viral_analysis';

create or replace view public.edit_jobs
with (security_invoker = true)
as
select
  id,user_id,video_id,output_video_id,status,progress,stage,
  created_at,started_at,completed_at,error,retry_count,max_retries,
  next_attempt_at,locked_at,locked_by,heartbeat_at,payload,result
from public.processing_jobs
where kind='edit_render';

revoke all on public.analysis_jobs from anon, authenticated;
revoke all on public.edit_jobs from anon, authenticated;
grant select on public.analysis_jobs to authenticated;
grant select on public.edit_jobs to authenticated;


-- Authenticated control-plane helper used by the web client.
-- It is idempotent on (user_id, idempotency_key), verifies media ownership,
-- and reserves one current beta analysis credit only when creating a NEW Viral+ job.
create or replace function public.create_processing_job(
  p_kind text,
  p_video_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns setof public.processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_job public.processing_jobs%rowtype;
  created_job public.processing_jobs%rowtype;
  entitlement record;
  merged_payload jsonb := coalesce(p_payload,'{}'::jsonb);
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind not in ('viral_analysis','edit_render') then
    raise exception 'invalid_job_kind';
  end if;

  if not exists (
    select 1
    from public.media_assets m
    where m.id = p_video_id
      and m.user_id = uid
      and m.deleted_at is null
      and m.status in ('uploaded','ready')
  ) then
    raise exception 'media_not_found';
  end if;

  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(uid::text || ':' || p_idempotency_key,0)
    );

    select *
      into existing_job
    from public.processing_jobs j
    where j.user_id = uid
      and j.idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return next existing_job;
      return;
    end if;
  end if;

  if p_kind = 'viral_analysis' then
    select *
      into entitlement
    from public.viralplus_consume_credit()
    limit 1;

    if entitlement.allowed is distinct from true then
      raise exception 'quota_exhausted';
    end if;

    merged_payload := merged_payload || jsonb_build_object(
      'credit_reserved', true,
      'credit_source', 'viralplus_beta_monthly'
    );
  end if;

  begin
    insert into public.processing_jobs(
      user_id,kind,video_id,status,progress,stage,
      idempotency_key,payload
    )
    values(
      uid,p_kind,p_video_id,'queued',0,'queued',
      p_idempotency_key,merged_payload
    )
    returning * into created_job;
  exception
    when unique_violation then
      if p_idempotency_key is null then
        raise;
      end if;

      select *
        into created_job
      from public.processing_jobs j
      where j.user_id = uid
        and j.idempotency_key = p_idempotency_key
      limit 1;
  end;

  if created_job.id is null then
    raise exception 'job_creation_failed';
  end if;

  insert into public.job_events(job_id,user_id,status,progress,message,details)
  values(
    created_job.id,uid,'queued',0,'Job queued',
    jsonb_build_object('kind',p_kind)
  )
  on conflict do nothing;

  return next created_job;
end;
$$;

revoke all on function public.create_processing_job(text,uuid,jsonb,text) from public, anon;
grant execute on function public.create_processing_job(text,uuid,jsonb,text) to authenticated;
