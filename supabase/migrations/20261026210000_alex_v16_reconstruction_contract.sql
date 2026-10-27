-- Prepared only; never applied to a remote database by this task.
-- Widen the existing contracts, preserving ALL previously accepted styles and
-- caption presets (including values added by other branches). No RLS/grant change.
BEGIN;
DO $body$
DECLARE
  item record;
  prior record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('style', 'hormozi_omni', 'edit_projects_style_check'),
    ('caption_preset', 'alex_v16', 'edit_projects_caption_preset_check')
  ) AS fields(column_name, allowed_value, constraint_name)
  LOOP
    SELECT conname, convalidated, pg_get_expr(conbin, conrelid) AS expression
      INTO prior FROM pg_constraint
      WHERE conrelid = 'public.edit_projects'::regclass
        AND conname = item.constraint_name AND contype = 'c';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Expected edit_projects constraint absent: %', item.constraint_name;
    END IF;
    IF strpos(prior.expression, quote_literal(item.allowed_value)) > 0 THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.edit_projects DROP CONSTRAINT %I', prior.conname);
    EXECUTE format('ALTER TABLE public.edit_projects ADD CONSTRAINT %I CHECK ((%s) OR %I = %L) NOT VALID',
      prior.conname, prior.expression, item.column_name, item.allowed_value);
    IF prior.convalidated THEN
      EXECUTE format('ALTER TABLE public.edit_projects VALIDATE CONSTRAINT %I', prior.conname);
    END IF;
  END LOOP;
END
$body$;
COMMIT;
