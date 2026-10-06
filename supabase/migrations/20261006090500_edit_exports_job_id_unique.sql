-- Make Edit+ export persistence idempotent per render job.
create unique index if not exists edit_exports_job_id_unique
on public.edit_exports(job_id)
where job_id is not null;
