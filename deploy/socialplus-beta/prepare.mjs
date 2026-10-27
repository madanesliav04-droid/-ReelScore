import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
const productionServices=new Set(['df3cab36-c2d4-466b-823c-ec5895685074','4a63fa3c-1839-4856-9fb9-59ccde9d478d','d973da1e-25d1-46e6-a46c-6b2e616ccbaf','3747de69-b1b3-4fc4-98ed-66a8f982d31e']);
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x||'');
export function validatePlan(p,now=Date.now()){
 const errors=[];const check=(ok,text)=>{if(!ok)errors.push(text);};
 check(/^[a-f0-9]{40}$/.test(p.gitCommit||''),'Pin the reviewed 40-character Git commit');
 check(p.vercel?.projectId==='prj_Wkh4h5DSZo3bPfeEMvX7elWkvCZt'&&p.vercel.target==='preview','Use the isolated Social+ project and built-in Vercel Preview only');
 check(p.railway?.projectId==='eff635d8-91ad-49f7-b53b-45748b7500f8','Railway project must be viral-edit');
 check(uuid(p.railway?.environmentId)&&p.railway.environmentId!=='c65ec871-c63f-442e-b39c-6abed0823cf0','An explicitly verified non-production Railway environment is required');
 check(uuid(p.railway?.serviceId)&&!productionServices.has(p.railway.serviceId),'Do not reuse a production Railway service');
 check(p.railway?.replicas===1,'Exactly one render worker replica is permitted');
 check(/^[a-z]{20}$/.test(p.supabase?.projectRef||'')&&p.supabase.projectRef!=='eiypztjpmxdiuaqxjuqx','Separate Supabase project required; never Liav CRM');
 for(const field of ['isolationVerified','signupDisabled','schemaVerified','privateBucketVerified'])check(p.supabase?.[field]===true,'Supabase prerequisite unverified: '+field);
 errors.push(...validateCost(p,now));
 return errors;
}
export function validateCost(p,now=Date.now()){
 const errors=[];const check=(ok,text)=>{if(!ok)errors.push(text);};
 const c=p.cost||{},date=Date.parse(c.evidenceDate);
 check(c.ownerVerified===true&&typeof c.evidenceReference==='string'&&c.evidenceReference.length>5,'Real account billing evidence and owner verification are required');
 check(Number.isFinite(date)&&date<=now&&now-date<=86400000,'Billing evidence must be dated within the last 24 hours');
 for(const key of ['includedCreditRemainingUSD','productionReserveUSD','betaReserveUSD'])check(Number.isFinite(c[key])&&c[key]>=0,'Missing account cost amount: '+key);
 check(c.betaReserveUSD>0,'Reserve a measured beta allowance within existing included usage');
 check(c.extraChargeUSD===0,'Additional authorized charge is exactly zero');
 check(c.includedCreditRemainingUSD>=c.productionReserveUSD+c.betaReserveUSD,'Included balance must cover existing production plus the beta reserve');
 return errors;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const [file,out,phase]=process.argv.slice(2);if(!file||!out)throw Error('Usage: node deploy/socialplus-beta/prepare.mjs PRIVATE_PLAN.json OUTPUT_DIRECTORY [--cost-only]');
 const p=JSON.parse(await readFile(file,'utf8')),errors=phase==='--cost-only'?validateCost(p):validatePlan(p);if(errors.length){console.error('BLOCKED — no resource created:\n'+errors.map(e=>' - '+e).join('\n'));process.exitCode=1;}
 else{await mkdir(out,{recursive:true,mode:0o700});await writeFile(path.join(out,phase==='--cost-only'?'validated-cost.json':'validated-plan.json'),JSON.stringify(p,null,2),{mode:0o600});console.log('Local plan validation passed. This verifies supplied values, not provider billing. No API, deployment or service creation was executed.');}
}
