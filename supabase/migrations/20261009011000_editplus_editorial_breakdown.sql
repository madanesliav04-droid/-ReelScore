-- New ninth Edit+ preset. Existing eight templates remain unchanged.
alter table public.edit_projects
  drop constraint if exists edit_projects_style_check;
alter table public.edit_projects
  add constraint edit_projects_style_check check
  (style in ('codie','impact','clean','authority','explainer','data',
             'ugc_native','cinematic_story','editorial_breakdown',
             'creator_clean','business_viral','podcast_authority'));

alter table public.edit_projects
  drop constraint if exists edit_projects_caption_preset_check;
alter table public.edit_projects
  add constraint edit_projects_caption_preset_check check
  (caption_preset in ('authority','impact','clean','explainer','data',
                      'ugc','cinematic','editorial','modern_bold',
                      'minimal','creator','karaoke'));
