-- Clip+ supports 5 / 10 / 20 requested outputs.
-- Quality-first selection may return fewer than requested.

alter table public.clip_projects
  drop constraint if exists clip_projects_requested_clip_count_check;

alter table public.clip_projects
  add constraint clip_projects_requested_clip_count_check
  check (requested_clip_count between 1 and 20);
