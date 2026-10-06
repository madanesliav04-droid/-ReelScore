-- Use a real unique constraint so PostgREST ON CONFLICT(job_id) can infer it.
drop index if exists public.edit_exports_job_id_unique;
alter table public.edit_exports
  drop constraint if exists edit_exports_job_id_key;
alter table public.edit_exports
  add constraint edit_exports_job_id_key unique (job_id);
