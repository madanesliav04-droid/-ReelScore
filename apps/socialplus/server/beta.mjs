// First-party beta measurements only: one activity day per member, no IP,
// device identifier, video contents or third-party analytics.
export function createBeta({db,ownerId,clock=()=>Date.now()}){
 db.exec(`CREATE TABLE IF NOT EXISTS beta_activity(user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,day TEXT NOT NULL,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS beta_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 db.prepare('INSERT OR IGNORE INTO beta_meta VALUES (?,?)').run('measurement_started_at',new Date(clock()).toISOString());
 const day=ms=>new Date(ms).toISOString().slice(0,10);
 function prune(){db.prepare('DELETE FROM beta_activity WHERE day<?').run(day(clock()-29*86400000));}
 function touch(userId){if(userId===ownerId)return;prune();db.prepare('INSERT OR IGNORE INTO beta_activity VALUES (?,?)').run(userId,day(clock()));}
 function summary(){
  prune();const owner=ownerId||'',since=day(clock()-29*86400000),week=day(clock()-6*86400000);
  const testers=db.prepare('SELECT count(*) n FROM security_users WHERE id<>?').get(owner).n;
  const active=db.prepare('SELECT count(DISTINCT user_id) n FROM beta_activity WHERE day>=? AND user_id<>?').get(week,owner).n;
  const cohort=db.prepare('SELECT user_id,count(*) days FROM beta_activity WHERE day>=? AND user_id<>? GROUP BY user_id').all(since,owner);
  const returning=cohort.filter(r=>r.days>=2).length;
  const feedback=db.prepare('SELECT count(*) count,count(DISTINCT user_id) respondents,avg(rating) average_rating,count(rating) rated FROM security_feedback WHERE user_id<>?').get(owner);
  const satisfaction=db.prepare('SELECT experience,satisfaction,count(*) count FROM security_feedback WHERE user_id<>? AND satisfaction IS NOT NULL GROUP BY experience,satisfaction').all(owner);
  const jobs=db.prepare('SELECT state,count(*) count FROM studio_jobs WHERE user_id<>? GROUP BY state').all(owner);
  const videos=db.prepare('SELECT count(*) n,COALESCE(sum(source_bytes+output_bytes),0) bytes FROM studio_projects WHERE user_id<>? AND source_path IS NOT NULL').get(owner);
  const analyses=db.prepare('SELECT count(*) n FROM studio_signal_reports WHERE user_id<>?').get(owner).n;
  const timing=db.prepare('SELECT count(elapsed_ms) measured,avg(elapsed_ms) average_ms,COALESCE(sum(elapsed_ms),0) total_ms FROM studio_render_requests WHERE user_id<>?').get(owner);
  const percent=(n,d)=>d?Math.round(n/d*10000)/100:null;
  return {beta:{accessDays:30,paid:false},measurementStartedAt:db.prepare('SELECT value FROM beta_meta WHERE key=?').get('measurement_started_at').value,testers,active7Days:active,returning30Days:returning,active30Days:cohort.length,returnRate:percent(returning,cohort.length),feedbackRate:percent(feedback.respondents,testers),feedback,satisfaction,renderJobs:jobs,videosStored:videos.n,storageBytes:videos.bytes,acousticReportsStored:analyses,processing:timing,notice:'Propriétaire exclu. Activité = au moins une requête applicative authentifiée dans la journée UTC ; conservation 30 jours. Retour = présence sur au moins deux jours distincts parmi les membres actifs sur 30 jours. Participation aux avis = auteurs distincts / testeurs inscrits. Médias, rapports, tâches et avis correspondent aux données encore conservées ; une suppression retire leurs données des agrégats. Aucun chiffre historique antérieur à la mesure d’activité n’est reconstitué.'};
 }
 return {touch,summary,exportData:userId=>db.prepare('SELECT day FROM beta_activity WHERE user_id=? ORDER BY day').all(userId)};
}
