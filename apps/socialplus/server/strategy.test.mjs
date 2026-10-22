import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Readable} from 'node:stream';
import {METHODS,SCORE_WEIGHTS,parseNumber,parseCSV,previewCSV,normalizeMetric,calculateRates,priority,buildDiagnostic,analyzeVideo,compareMetrics,createStrategy} from './strategy.mjs';

const base={platform:'instagram',external_post_id:'post-1',publication_at:'2026-10-01',collected_at:'2026-10-02',reach:1000,views:1200,likes:20,comments:3,shares:5,saves:2,video_duration_seconds:10,average_watch_seconds:15,format:'reel',observation_window:'24h',definition_version:'manual-v1'};
const fingerprint='a'.repeat(64);
const video={fingerprint,metadata:{duration_seconds:10,width:1920,height:1080,has_audio:true},context:{goal_type:'awareness'}};
const csv='date publication;date collecte;portée;vues;durée moyenne;durée\n2026-10-01;2026-10-02;1 000;1200;12,5;10';

function harness(){
 const db=new DatabaseSync(':memory:');const strategy=createStrategy({db});
 const request=async(path,method='GET',data,uid='a')=>{
  const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);req.method=method;
  let status=0,output='';const res={writeHead(code){status=code;},end(value){output=value;}};
  const handled=await strategy.handle(req,res,new URL(path,'http://localhost'),uid?{id:uid}:null);
  return {handled,status,body:output?JSON.parse(output):null};
 };
 return {db,strategy,request};
}

test('FR decimal, whitespace, missing and zero have distinct meanings',()=>{
 assert.equal(parseNumber('1\u202f234,5'),1234.5);assert.equal(parseNumber(''),null);assert.equal(parseNumber(0),0);
 for(const bad of ['-1','NaN','1,234.5','infinity',true])assert.throws(()=>parseNumber(bad));
});
test('CSV FR headers and decimals are normalized with a preview',()=>{
 const result=previewCSV({csv,platform:'instagram'});
 assert.equal(result.valid_count,1);assert.equal(result.rows[0].reach,1000);assert.equal(result.rows[0].average_watch_seconds,12.5);assert.equal(result.rows[0].shares,null);
});
test('CSV comma delimiter, escaped quotes, embedded newlines and BOM work',()=>{
 const p=parseCSV('\uFEFFdate,topic\n2026-10-01,"Un titre, avec ""citation""\net suite"');
 assert.equal(p.delimiter,',');assert.equal(p.rows[0][1],'Un titre, avec "citation"\net suite');
});
test('CSV rejects malformed quotes, duplicate headers and excessive row width',()=>{
 assert.throws(()=>parseCSV('a;b\n"unfinished;b'));
 assert.throws(()=>parseCSV('portée;portee\n1;2'));
 assert.equal(previewCSV({csv:'date;date collecte;vues\n2026-10-01;2026-10-02;1;2',platform:'instagram'}).errors.length,1);
});
test('CSV invalid dates and negative metrics are reported without fake values',()=>{
 const p=previewCSV({csv:'date;date collecte;portée\n2026-02-30;2026-10-02;1\n2026-10-01;2026-10-02;-2',platform:'instagram'});
 assert.equal(p.rows.length,0);assert.equal(p.errors.length,2);
});
test('missing shares stay unavailable; reach zero has no divide by zero',()=>{
 const metric=normalizeMetric({...base,shares:null,reach:0});const rates=calculateRates(metric);
 assert.equal(metric.shares,null);assert.equal(rates.share_rate,null);assert.equal(rates.engagement_rate,null);
});
test('engagement requires every component; replay watch ratio can exceed 100%',()=>{
 const metric=normalizeMetric(base);assert.equal(calculateRates(metric).engagement_rate,3);assert.equal(calculateRates(metric).watch_ratio,150);
 assert.equal(calculateRates({...metric,saves:null}).engagement_rate,null);
});
test('profile action conversion requires documented attribution',()=>{
 const metric=normalizeMetric({...base,profile_visits:50,follows:5,follows_attributed:3});
 assert.equal(calculateRates(metric).profile_action_rate,null);assert.equal(calculateRates(metric).profile_period_ratio,10);
 assert.equal(calculateRates({...metric,attribution_documented:true}).profile_action_rate,6);
});
test('metric validation rejects collect before publication and empty measures',()=>{
 assert.throws(()=>normalizeMetric({...base,collected_at:'2026-09-01'}));
 assert.throws(()=>normalizeMetric({platform:'instagram',publication_at:'2026-10-01',collected_at:'2026-10-02'}));
});
test('all 12 pedagogical methods have source, exercise, steps and measurement',()=>{
 assert.equal(METHODS.length,12);for(const method of METHODS){assert.match(method.source_url,/^https:\/\//);assert.ok(method.exercise.length>30);assert.ok(method.process_steps.length>=3);assert.ok(method.success_metrics.length);}
});
test('priority uses the V18 formula with bounded components',()=>{
 assert.equal(priority({impact:5,gap:5,confidence:5,ease:5}),100);
 assert.equal(priority({impact:4,gap:3,confidence:2,ease:1}),58);
 assert.throws(()=>priority({impact:6,gap:1,confidence:1,ease:1}));
});
test('identical snapshots produce identical diagnostics, priorities and missions',()=>{
 const a=buildDiagnostic({profile:{goal_type:'leads'},metrics:[normalizeMetric(base)]});
 const b=buildDiagnostic({profile:{goal_type:'leads'},metrics:[normalizeMetric(base)]});
 assert.deepEqual(a,b);assert.ok(a.missions.length<=3);assert.equal(a.missions[0].method_id,'M12');
});
test('goal changes priorities and decisions remain linked to relevant KPI',()=>{
 const common={target_audience:'Entrepreneurs',niche:'Conseil',bio_text:'Conseil utile'};
 const a=buildDiagnostic({profile:{...common,goal_type:'awareness'}}),b=buildDiagnostic({profile:{...common,goal_type:'leads'}});
 assert.notDeepEqual(a.missions.map(m=>m.method_id),b.missions.map(m=>m.method_id));
 assert.ok(b.findings.some(f=>f.method_id==='M11'));
});
test('inactive and unsourced methods never produce new missions',()=>{
 const d=buildDiagnostic({methods:METHODS.map(m=>({...m,enabled:m.id!=='M01',source_url:m.id==='M02'?null:m.source_url}))});
 assert.ok(d.missions.every(m=>!['M01','M02'].includes(m.method_id)));
});
test('historical method version is retained in diagnostic snapshot',()=>{
 const d=buildDiagnostic({methods:METHODS.map(m=>({...m,version:2}))});
 assert.ok(d.missions.every(m=>m.method_version===2));assert.equal(METHODS[0].version,1);
});
test('five snapshots of a single post are not five independent contents',()=>{
 const metrics=Array.from({length:5},(_,i)=>({...normalizeMetric(base),collected_at:`2026-10-0${i+2}`}));
 assert.equal(buildDiagnostic({metrics}).findings.find(f=>f.rule_id==='collect_comparable').observation.startsWith('1 contenu'),true);
});
test('without transcript semantic criteria are excluded and global score is unavailable',()=>{
 const a=analyzeVideo(video);assert.equal(a.score,null);assert.equal(a.coverage,0);assert.equal(a.excluded_criteria.length,11);assert.equal(a.native_ratio,1920/1080);
 const b=analyzeVideo({...video,criteria:{hook:{score:90,evidence:'Promesse très claire donnée dans le début.',source_kind:'manual',start_sec:0,end_sec:2}}});
 assert.equal(b.score,null);assert.equal(b.coverage,0);assert.match(b.excluded_criteria.find(x=>x.key==='hook').reason,/Transcription/);
});
test('video review is reproducible, coverage conditional, and weighted score exact',()=>{
 const criteria=Object.fromEntries(Object.keys(SCORE_WEIGHTS).map(key=>[key,{score:80,evidence:'Observation personnelle vérifiée sur ce passage précis.',source_kind:'manual',start_sec:0,end_sec:2}]));
 const raw={...video,transcript:{text:'Le discours réellement transcrit et fourni par le créateur.'},criteria};
 const a=analyzeVideo(raw);assert.equal(a.coverage,100);assert.equal(a.score,80);assert.deepEqual(a,analyzeVideo(raw));
});
test('video timestamps outside duration are excluded and unknown score rejects',()=>{
 const a=analyzeVideo({...video,criteria:{visual:{score:60,evidence:'Observation précise, documentée et effectivement vérifiée.',source_kind:'manual',start_sec:9,end_sec:30}}});
 assert.equal(a.coverage,0);assert.match(a.excluded_criteria.find(x=>x.key==='visual').reason,/Timecodes/);
 assert.throws(()=>analyzeVideo({...video,criteria:{visual:{score:300,source_kind:'manual'}}}));
});
test('format/period/platform/definition mismatch refuses misleading comparison',()=>{
 const metric=normalizeMetric(base);
 assert.equal(compareMetrics(metric,{...metric,platform:'youtube'}).comparable,false);
 assert.equal(compareMetrics(metric,{...metric,observation_window:'7d'}).comparable,false);
 assert.equal(compareMetrics(metric,metric).comparable,true);
 assert.equal(compareMetrics({...metric,platform:'youtube',definition_version:null},{...metric,platform:'youtube',definition_version:null}).comparable,false);
});
test('API requires authentication and unknown strategy action is 404',async()=>{
 const h=harness();assert.equal((await h.request('/api/strategy/profile','GET',null,null)).status,401);
 assert.equal((await h.request('/api/strategy/does-not-exist')).status,404);h.db.close();
});
test('profile is persisted and isolated by authenticated user',async()=>{
 const h=harness();assert.equal((await h.request('/api/strategy/profile','PUT',{niche:'Conseil',bio_text:'Ma bio'})).status,200);
 assert.equal((await h.request('/api/strategy/profile')).body.profile.niche,'Conseil');
 assert.equal((await h.request('/api/strategy/profile','GET',null,'b')).body.profile.niche,undefined);h.db.close();
});
test('CSV confirmation is explicit, atomic and idempotent including a second preview',async()=>{
 const h=harness();const p=await h.request('/api/strategy/imports/preview','POST',{csv,platform:'instagram'});
 assert.equal(p.status,200);assert.equal((await h.request('/api/strategy/metrics')).body.metrics.length,0);
 const first=await h.request('/api/strategy/imports','POST',{preview_id:p.body.preview_id});assert.equal(first.body.imported,1);
 const p2=await h.request('/api/strategy/imports/preview','POST',{csv,platform:'instagram'});
 const second=await h.request('/api/strategy/imports','POST',{preview_id:p2.body.preview_id});assert.equal(second.body.imported,0);assert.equal(second.body.skipped,1);
 assert.equal((await h.request('/api/strategy/metrics')).body.metrics.length,1);h.db.close();
});
test('user B cannot redeem user A preview or mutate A mission',async()=>{
 const h=harness();const p=await h.request('/api/strategy/imports/preview','POST',{csv,platform:'instagram'});
 assert.equal((await h.request('/api/strategy/imports','POST',{preview_id:p.body.preview_id},'b')).status,404);
 const d=await h.request('/api/strategy/diagnostic','POST',{});assert.equal(d.status,201);
 assert.equal((await h.request('/api/strategy/missions/'+d.body.diagnostic.missions[0].id,'PATCH',{status:'done'},'b')).status,404);h.db.close();
});
test('diagnostic cache is stable and mission completion persists',async()=>{
 const h=harness();const first=await h.request('/api/strategy/diagnostic','POST',{}),second=await h.request('/api/strategy/diagnostic','POST',{});
 assert.equal(first.body.diagnostic.id,second.body.diagnostic.id);
 const mission=first.body.diagnostic.missions[0];const done=await h.request('/api/strategy/missions/'+mission.id,'PATCH',{status:'done',completion_note:'Exercice réalisé'});
 assert.equal(done.body.mission.status,'done');assert.equal((await h.request('/api/strategy/missions')).body.missions.find(m=>m.id===mission.id).status,'done');
 const reopened=await h.request('/api/strategy/missions/'+mission.id,'PATCH',{status:'active'});
 assert.equal(reopened.body.mission.completion_note,'Exercice réalisé');
 const stepped=await h.request('/api/strategy/missions/'+mission.id,'PATCH',{steps:mission.steps.map(()=>({completed:true}))});
 assert.equal(stepped.body.mission.completion_note,'Exercice réalisé');
 assert.ok(stepped.body.mission.steps.every(step=>step.completed));h.db.close();
});
test('postpublication snapshots never rewrite historical prepublication score',async()=>{
 const h=harness();const analysis=(await h.request('/api/strategy/video-analyses','POST',video)).body.analysis;
 const before=(await h.request('/api/strategy/metrics','POST',base)).body.metric;
 const after=(await h.request('/api/strategy/metrics','POST',{...base,external_post_id:'post-2',publication_at:'2026-10-03',collected_at:'2026-10-04',shares:8})).body.metric;
 const r=await h.request('/api/strategy/results','POST',{before_metric_id:before.id,after_metric_id:after.id,analysis_id:analysis.id});
 assert.equal(r.status,201);assert.equal(r.body.result.analysis_snapshot.score,null);
 assert.deepEqual((await h.request('/api/strategy/video-analyses')).body.analyses[0],analysis);h.db.close();
});
test('competitors need public source and export/delete remain user isolated',async()=>{
 const h=harness();assert.equal((await h.request('/api/strategy/competitors','POST',{handle:'x',source_public:'javascript:alert(1)'})).status,400);
 await h.request('/api/strategy/profile','PUT',{niche:'A'});await h.request('/api/strategy/profile','PUT',{niche:'B'},'b');
 assert.ok(h.strategy.exportData('a').some(x=>x.niche==='A'));h.strategy.deleteData('a');assert.equal(h.strategy.exportData('a').length,0);assert.ok(h.strategy.exportData('b').length);h.db.close();
});

test('valid ISO timezones normalize without mistaking local date for impossible day',()=>{
 const metric=normalizeMetric({...base,publication_at:'2026-10-01T00:00:00+02:00',collected_at:'2026-10-02T00:00:00+02:00'});
 assert.equal(metric.publication_at,'2026-09-30T22:00:00.000Z');
 assert.throws(()=>normalizeMetric({...base,publication_at:'2026-10-01T10:00:00'}));
});
test('CSV duplicate mapping and contradictory evidence cannot silently overwrite a metric',()=>{
 assert.throws(()=>previewCSV({csv:'date;date collecte;shares;partages\n2026-10-01;2026-10-02;1;2',platform:'instagram'}));
 const preview=previewCSV({csv:'id;date;date collecte;vues\none;2026-10-01;2026-10-02;1\none;2026-10-01;2026-10-02;2',platform:'instagram'});
 assert.equal(preview.valid_count,0);assert.equal(preview.errors[0].field,'CONFLICTING_METRIC');
});
test('manual conflicting snapshot is rejected and original remains immutable',async()=>{
 const h=harness();await h.request('/api/strategy/metrics','POST',base);
 const conflict=await h.request('/api/strategy/metrics','POST',{...base,views:999});
 assert.equal(conflict.status,409);assert.equal((await h.request('/api/strategy/metrics')).body.metrics.length,1);h.db.close();
});
test('admin methods require owner MFA; published history is immutable and disable blocks missions',async()=>{
 const h=harness();
 const admin=async(method,data,owner,path='/api/admin/method-versions')=>{
  const req=Readable.from(data?[Buffer.from(JSON.stringify(data))]:[]);req.method=method;let status,output;
  await h.strategy.handleAdmin(req,{writeHead(c){status=c;},end(v){output=JSON.parse(v);}},new URL(path,'http://local'),owner);return{status,body:output};
 };
 assert.equal((await admin('GET',null,{id:'a',role:'member',mfa_verified:true})).status,403);
 assert.equal((await admin('GET',null,{id:'owner',role:'owner',mfa_verified:false})).status,403);
 const owner={id:'owner',role:'owner',mfa_verified:true};
 const old=(await h.request('/api/strategy/diagnostic','POST',{})).body.diagnostic;
 const m=METHODS.find(m=>m.id==='M01');
 const changed=await admin('POST',{...m,method_id:'M01',title:'Audience : version deux'},owner);
 assert.equal(changed.status,201);assert.equal(changed.body.method.version,2);
 assert.equal((await admin('GET',null,owner)).body.versions.filter(v=>v.method_id==='M01').length,2);
 const fresh=(await h.request('/api/strategy/diagnostic','POST',{})).body.diagnostic;
 assert.equal(fresh.findings.find(f=>f.method_id==='M01').method_version,2);
 assert.equal(old.findings.find(f=>f.method_id==='M01').method_version,1);
 await admin('PATCH',{enabled:false},owner,'/api/admin/method-versions/M01');
 const disabled=(await h.request('/api/strategy/diagnostic','POST',{})).body.diagnostic;
 assert.ok(disabled.missions.every(m=>m.method_id!=='M01'));h.db.close();
});
