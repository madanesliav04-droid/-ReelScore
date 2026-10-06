-- Cover foreign keys used by shared Viral+ / Edit+ joins.
create index if not exists credit_ledger_job_id_idx on public.credit_ledger(job_id) where job_id is not null;
create index if not exists edit_exports_job_id_idx on public.edit_exports(job_id) where job_id is not null;
create index if not exists edit_exports_output_video_id_idx on public.edit_exports(output_video_id);
create index if not exists edit_exports_project_id_idx on public.edit_exports(project_id);
create index if not exists edit_projects_source_analysis_id_idx on public.edit_projects(source_analysis_id) where source_analysis_id is not null;
create index if not exists edit_projects_source_video_id_idx on public.edit_projects(source_video_id);
create index if not exists processing_jobs_output_video_id_idx on public.processing_jobs(output_video_id) where output_video_id is not null;
