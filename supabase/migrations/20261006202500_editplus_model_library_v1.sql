-- Edit+ V1 model library contracts
-- Live schema was validated before this migration was committed.

alter table public.edit_projects
  drop constraint if exists edit_projects_style_check,
  drop constraint if exists edit_projects_caption_preset_check;

alter table public.edit_projects
  add constraint edit_projects_style_check
  check (
    style = any (
      array[
        'codie',
        'impact',
        'clean',
        'authority',
        'explainer',
        'data',
        'ugc_native',
        'cinematic_story',
        'creator_clean',
        'business_viral',
        'podcast_authority'
      ]::text[]
    )
  );

alter table public.edit_projects
  add constraint edit_projects_caption_preset_check
  check (
    caption_preset = any (
      array[
        'authority',
        'impact',
        'clean',
        'explainer',
        'data',
        'ugc',
        'cinematic',
        'modern_bold',
        'minimal',
        'creator',
        'karaoke'
      ]::text[]
    )
  );
