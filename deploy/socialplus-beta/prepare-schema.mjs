import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
const [ref,output]=process.argv.slice(2);
if(!/^[a-z]{20}$/.test(ref||'')||ref==='eiypztjpmxdiuaqxjuqx')throw Error('Supply a NEW isolated Supabase project ref, never the shared production project');
if(!output)throw Error('Usage: node deploy/socialplus-beta/prepare-schema.mjs ISOLATED_REF OUTPUT.sql');
const root=fileURLToPath(new URL('../../',import.meta.url));
let sql=`-- Alex-only isolated beta bootstrap for project ${ref}. REVIEW TARGET IN DASHBOARD.
-- Fresh Supabase project only. No production data, fake analysis or credit function.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.media_assets') IS NOT NULL OR to_regclass('public.viralplus_profiles') IS NOT NULL OR to_regclass('public.viralplus_analyses') IS NOT NULL THEN
  RAISE EXCEPTION 'Refusing non-fresh application database: do not run against production';
 END IF;
END $$;
-- Minimal legacy FK/quota prerequisites, kept empty; analysis admission is disabled.
CREATE TABLE public.viralplus_analyses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),result_json jsonb);
CREATE TABLE public.viralplus_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),analyses_used integer NOT NULL DEFAULT 0,period_start timestamptz NOT NULL DEFAULT date_trunc('month',now()),updated_at timestamptz DEFAULT now());
ALTER TABLE public.viralplus_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viralplus_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.viralplus_profiles,public.viralplus_analyses FROM anon,authenticated;
`;
const names=['20261006090000_shared_viral_edit_core.sql','20261006090200_worker_queue.sql','20261006090400_durable_job_quota.sql','20261006090500_edit_exports_job_id_unique.sql','20261006102500_edit_exports_job_unique_constraint.sql','20261006112000_clipplus_core.sql','20261006202500_editplus_model_library_v1.sql','20261006212500_fix_processing_job_priority_and_clip_indexes.sql','20261006214500_clipplus_20_quality_first.sql','20261009011000_editplus_editorial_breakdown.sql','20261009024500_viralplus_beta_quota_allowance.sql','20261026210000_alex_v16_reconstruction_contract.sql'];
for(const name of names){
 if(name==='20261006090200_worker_queue.sql')sql+='\n-- Historical return-type change: drop only the RPC just created in this fresh transaction.\nDROP FUNCTION public.create_processing_job(text,uuid,jsonb,text);\n';
 let part=await readFile(path.join(root,'supabase/migrations',name),'utf8');
 if(name==='20261026210000_alex_v16_reconstruction_contract.sql')part=part.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
 // Some historical files rely on psql EOF to terminate the final dollar-quoted function.
 sql+='\n-- Existing migration: '+name+'\n'+part+'\n;\n';
}
sql+=`
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('viralplus-videos','viralplus-videos',false,50000000,ARRAY['video/mp4','video/quicktime','video/webm']);
-- 50 MB per object fits free-project storage limits; frontend already chunks large imports.
CREATE POLICY socialplus_beta_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='viralplus-videos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY socialplus_beta_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='viralplus-videos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY socialplus_beta_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='viralplus-videos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text)
WITH CHECK (bucket_id='viralplus-videos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY socialplus_beta_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='viralplus-videos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
NOTIFY pgrst,'reload schema';
COMMIT;
`;
await writeFile(output,sql,{mode:0o600});console.log('Prepared fresh-isolated-project SQL only. No database connection or remote execution performed.');
