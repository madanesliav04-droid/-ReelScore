import {randomUUID} from 'node:crypto';
// SQLite serializes lease acquisition; no stale-file unlink race, no network service.
export function acquireRuntimeLock(db){
 db.exec('CREATE TABLE IF NOT EXISTS socialplus_runtime_lock(id INTEGER PRIMARY KEY CHECK(id=1),pid INTEGER NOT NULL,token TEXT NOT NULL)');
 const token=randomUUID();
 db.exec('BEGIN IMMEDIATE');
 try{
  const previous=db.prepare('SELECT pid FROM socialplus_runtime_lock WHERE id=1').get();
  if(previous){let alive=true;try{process.kill(previous.pid,0);}catch(e){alive=e.code!=='ESRCH';}
   if(alive)throw Object.assign(Error('Une instance Social+ utilise déjà ce dossier de données. Arrêtez-la avant de redémarrer.'),{code:'LOCAL_INSTANCE_RUNNING'});
  }
  db.prepare('INSERT OR REPLACE INTO socialplus_runtime_lock VALUES(1,?,?)').run(process.pid,token);db.exec('COMMIT');
 }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}
 return ()=>{try{db.prepare('DELETE FROM socialplus_runtime_lock WHERE id=1 AND token=?').run(token);}catch{/* Database may already be closed during process teardown. */}};
}
