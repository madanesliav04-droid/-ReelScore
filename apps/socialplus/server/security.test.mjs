import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { createSecurity, totpCode, hashPassword, verifyPassword, HttpError } from './security.mjs';

const OWNER_SEED='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // RFC 6238 public test vector, never a real account secret.
const PASSWORD='Fixture password 123!';
async function fixture(){
  const db=new DatabaseSync(':memory:');let now=1_700_000_000_000;const id=randomUUID(),purged=[];
  const config={origin:'http://localhost:3000',ownerId:id,ownerTotpSecret:OWNER_SEED,now:()=>now,exportUserData:async userId=>({projects:[{owner_user_id:userId}]}),deleteUserData:async userId=>purged.push(userId)};
  const security=createSecurity({db,config});await security.provisionOwner({id,email:'owner@example.test',password:PASSWORD,displayName:'Owner'});
  async function request(path,{method='GET',data,cookie,csrf,origin=config.origin,ip='127.0.0.1'}={}){
    const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);req.method=method;req.headers={'content-type':'application/json',origin,...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{})};req.socket={remoteAddress:ip};
    const res={status:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,headers){this.status=status;for(const[k,v]of Object.entries(headers))this.setHeader(k,v);},end(value){this.body=JSON.parse(value);}};
    try{const handled=await security.handle(req,res,new URL(path,config.origin));if(!handled)res.status=404;}catch(e){if(!(e instanceof HttpError))throw e;res.status=e.status;res.body={code:e.code,message:e.message};}
    return {...res,cookie:res.headers['set-cookie']?.split(';')[0]};
  }
  const login=await request('/api/auth/login',{method:'POST',data:{email:'owner@example.test',password:PASSWORD,totp:totpCode(OWNER_SEED,Math.floor(now/30_000))}});assert.equal(login.status,200);
  const owner={cookie:login.cookie,csrf:login.body.csrf};
  async function member(email='member@example.test',durationDays=7){
    const invite=await request('/api/admin/invites',{method:'POST',...owner,data:{email,emailVerifiedByOwner:true,durationDays}});assert.equal(invite.status,201);
    const activated=await request('/api/auth/activate',{method:'POST',data:{email,password:PASSWORD,displayName:'Membre',code:invite.body.code,acceptTerms:true,role:'owner'}});assert.equal(activated.status,201);
    return {id:activated.body.user.id,cookie:activated.cookie,cookieHeader:activated.headers['set-cookie'],csrf:activated.body.csrf,invite:invite.body};
  }
  return {db,security,config,request,owner,member,purged,setNow(value){now=value;},now:()=>now};
}

test('password hashes are salted scrypt and invalid passwords fail',async()=>{
  const a=await hashPassword(PASSWORD),b=await hashPassword(PASSWORD);assert.notEqual(a,b);assert(!a.includes(PASSWORD));assert(await verifyPassword(PASSWORD,a));assert(!await verifyPassword('incorrect',a));await assert.rejects(hashPassword('short'),{code:'invalid_password'});
});
test('TOTP implements RFC6238 public SHA1 vector',()=>{assert.equal(totpCode(OWNER_SEED,1),'287082');});
test('owner requires MFA, TOTP replay fails, member cannot elevate',async()=>{
  const f=await fixture();const a=await f.request('/api/auth/login',{method:'POST',data:{email:'owner@example.test',password:PASSWORD}});assert.equal(a.status,401);assert.equal(a.body.code,'mfa_required');
  const replay=await f.request('/api/auth/login',{method:'POST',data:{email:'owner@example.test',password:PASSWORD,totp:totpCode(OWNER_SEED,Math.floor(f.now()/30_000))}});assert.equal(replay.status,401);
  const user=await f.member();const session=await f.request('/api/session',user);assert.equal(session.body.user.role,'member');assert.equal((await f.request('/api/admin/members',user)).status,403);
  const unauth=await f.request('/api/admin/members');assert.equal(unauth.status,401);f.db.close();
});
test('owner identity and MFA fail closed outside server configuration',async()=>{
  const db=new DatabaseSync(':memory:');const s=createSecurity({db,config:{ownerId:'configured'}});await assert.rejects(s.provisionOwner({id:'other',email:'x@example.test',password:PASSWORD}),/match/);await assert.rejects(s.provisionOwner({id:'configured',email:'x@example.test',password:PASSWORD}),/TOTP/);assert.throws(()=>createSecurity({db,config:{origin:'http://public.example'}}),/HTTPS/);db.close();
});
test('targeted invitations require attestation, email match and terms; secret only shown once',async()=>{
  const f=await fixture();const denied=await f.request('/api/admin/invites',{method:'POST',...f.owner,data:{email:'a@example.test',durationDays:7}});assert.equal(denied.body.code,'email_attestation_required');
  const i=await f.request('/api/admin/invites',{method:'POST',...f.owner,data:{email:'a@example.test',emailVerifiedByOwner:true,durationDays:30}});
  assert.equal(i.status,201);assert.equal(i.body.code.length,43);const stored=f.db.prepare('SELECT * FROM security_invites WHERE id=?').get(i.body.id);assert.notEqual(stored.code_hash,i.body.code);assert(!JSON.stringify(stored).includes(i.body.code));
  const bad=await f.request('/api/auth/activate',{method:'POST',data:{email:'other@example.test',password:PASSWORD,displayName:'A',acceptTerms:true,code:i.body.code}});assert.equal(bad.status,400);
  const noTerms=await f.request('/api/auth/activate',{method:'POST',data:{email:'a@example.test',password:PASSWORD,displayName:'A',code:i.body.code}});assert.equal(noTerms.body.code,'terms_required');
  const listed=await f.request('/api/admin/invites',f.owner);assert(!JSON.stringify(listed.body).includes(i.body.code));assert(!JSON.stringify(f.db.prepare('SELECT * FROM security_audit').all()).includes(i.body.code));f.db.close();
});
test('exact expiry, 30 days/permanent and immediate revoke are enforced on each request',async()=>{
  const f=await fixture(),seven=await f.member('seven@example.test',7),thirty=await f.member('thirty@example.test',30),permanent=await f.member('permanent@example.test',null);
  assert.equal(f.security.activeGrant(seven.id).expires_at,f.now()+7*86400000);assert.equal(f.security.activeGrant(thirty.id).expires_at,f.now()+30*86400000);assert.equal(f.security.activeGrant(permanent.id).expires_at,null);
  const revoked=await f.request(`/api/admin/members/${seven.id}/revoke`,{method:'POST',...f.owner,data:{}});assert.equal(revoked.status,200);assert.equal((await f.request('/api/session',seven)).body.user,null);
  // Re-login before advancing to avoid testing a session timeout in place of grant expiry.
  f.setNow(f.now()+30*86400000);const expired=await f.request('/api/auth/login',{method:'POST',data:{email:'thirty@example.test',password:PASSWORD}});assert.equal(expired.body.code,'access_expired');const active=await f.request('/api/auth/login',{method:'POST',data:{email:'permanent@example.test',password:PASSWORD}});assert.equal(active.status,200);f.db.close();
});
test('single-use codes redeem atomically, replay is idempotent and unverified email cannot register',async()=>{
  const f=await fixture(),a=await f.member('a@example.test'),b=await f.member('b@example.test');
  const invite=await f.request('/api/admin/invites',{method:'POST',...f.owner,data:{durationDays:7,maxUses:1}});
  const unverified=await f.request('/api/auth/activate',{method:'POST',data:{email:'new@example.test',password:PASSWORD,displayName:'N',acceptTerms:true,code:invite.body.code}});assert.equal(unverified.body.code,'email_verification_required');
  const outcomes=await Promise.all([a,b].map(user=>f.request('/api/gifts/redeem',{method:'POST',...user,data:{code:invite.body.code}})));assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,400]);assert.equal(f.db.prepare('SELECT uses FROM security_invites WHERE id=?').get(invite.body.id).uses,1);
  const winner=outcomes[0].status===200?a:b,before=f.security.activeGrant(winner.id);const replay=await f.request('/api/gifts/redeem',{method:'POST',...winner,data:{code:invite.body.code}});assert.equal(replay.status,200);assert.deepEqual(f.security.activeGrant(winner.id),before);assert.equal(f.db.prepare('SELECT uses FROM security_invites WHERE id=?').get(invite.body.id).uses,1);f.db.close();
});
test('Origin and CSRF protect writes; HttpOnly Strict cookie used; credentials do not leak',async()=>{
  const f=await fixture();const noToken=await f.request('/api/admin/invites',{method:'POST',cookie:f.owner.cookie,data:{durationDays:7}});assert.equal(noToken.status,403);
  const crossSite=await f.request('/api/admin/invites',{method:'POST',...f.owner,origin:'https://attacker.example',data:{durationDays:7}});assert.equal(crossSite.status,403);
  const login=await f.request('/api/auth/login',{method:'POST',origin:'https://attacker.example',data:{email:'owner@example.test',password:PASSWORD}});assert.equal(login.status,403);
  const member=await f.member();assert.match(member.cookie,/^socialplus=/);assert.match(member.cookieHeader,/HttpOnly/);assert.match(member.cookieHeader,/SameSite=Strict/);const rows=await f.request('/api/admin/members',f.owner);assert(!JSON.stringify(rows.body).includes('password_hash'));assert(!JSON.stringify(rows.body).includes('csrf_hash'));assert(f.db.prepare("SELECT count(*) n FROM security_audit WHERE action='security.role_input_ignored'").get().n>0);f.db.close();
});
test('feedback remains tenant-private, owner can triage and FAQ publication is explicit',async()=>{
  const f=await fixture(),a=await f.member('a@example.test'),b=await f.member('b@example.test');
  const feedback=await f.request('/api/feedback',{method:'POST',...a,data:{category:'bug',body:'La lecture ne démarre pas.',rating:2}});assert.equal(feedback.status,201);
  const stored=f.db.prepare('SELECT * FROM security_feedback WHERE id=?').get(feedback.body.id);assert.equal(stored.publication_consent,0);assert.equal((await f.request('/api/feedback',b)).body.entries.length,0);
  assert.equal((await f.request('/api/admin/feedback',a)).status,403);assert.equal((await f.request(`/api/admin/feedback/${stored.id}`,{method:'PATCH',...f.owner,data:{status:'résolu',reply:'Correction installée.'}})).status,200);assert.equal((await f.request('/api/feedback',a)).body.entries[0].owner_reply,'Correction installée.');
  const saved=await f.request('/api/admin/faq',{method:'POST',...f.owner,data:{question:'Comment accéder ?',answer:'Invitation privée du propriétaire.',published:false}});assert.equal(saved.status,200);assert.equal((await f.request('/api/faq')).body.entries.length,0);
  await f.request('/api/admin/faq',{method:'PATCH',...f.owner,data:{id:saved.body.id,question:'Comment accéder ?',answer:'Invitation privée du propriétaire.',published:true}});assert.equal((await f.request('/api/faq')).body.entries.length,1);f.db.close();
});
test('privacy export contains own data; confirmed deletion purges hooks, account and sessions',async()=>{
  const f=await fixture(),a=await f.member(),exported=await f.request('/api/privacy/export',a);assert.equal(exported.status,200);assert.equal(exported.body.profile.id,a.id);assert.equal(exported.body.projects[0].owner_user_id,a.id);assert(!JSON.stringify(exported.body).includes('password_hash'));
  const rejected=await f.request('/api/privacy/delete',{method:'POST',...a,data:{password:'incorrect',confirm:'SUPPRIMER'}});assert.equal(rejected.status,401);assert.equal(f.purged.length,0);
  const deleted=await f.request('/api/privacy/delete',{method:'POST',...a,data:{password:PASSWORD,confirm:'SUPPRIMER'}});assert.equal(deleted.status,200);assert.deepEqual(f.purged,[a.id]);assert.equal(f.db.prepare('SELECT count(*) n FROM security_users WHERE id=?').get(a.id).n,0);assert.equal((await f.request('/api/session',a)).body.user,null);f.db.close();
});
test('password recovery tokens expire/revoke sessions and are one use',async()=>{
  const f=await fixture(),a=await f.member(),issued=await f.request(`/api/admin/members/${a.id}/reset-password`,{method:'POST',...f.owner,data:{}});assert.equal(issued.status,201);
  const recovered=await f.request('/api/auth/reset',{method:'POST',data:{email:'member@example.test',code:issued.body.code,password:'A new fixture password 456!'}});assert.equal(recovered.status,200);assert.equal((await f.request('/api/session',a)).body.user,null);
  const replay=await f.request('/api/auth/reset',{method:'POST',data:{email:'member@example.test',code:issued.body.code,password:PASSWORD}});assert.equal(replay.status,400);assert(!JSON.stringify(f.db.prepare('SELECT * FROM security_audit').all()).includes(issued.body.code));f.db.close();
});
test('authentication attempts are rate limited by socket identity, not spoofable forwarding headers',async()=>{
  const f=await fixture();for(let i=0;i<10;i++){const r=await f.request('/api/auth/login',{method:'POST',ip:'192.0.2.1',data:{email:'bad'}});assert.equal(r.status,400);}
  const limited=await f.request('/api/auth/login',{method:'POST',ip:'192.0.2.1',data:{email:'owner@example.test',password:PASSWORD}});assert.equal(limited.status,429);f.db.close();
});
test('a new invitation can renew an expired verified account with its current password',async()=>{
  const f=await fixture(),a=await f.member();f.db.prepare('UPDATE security_grants SET expires_at=? WHERE user_id=?').run(f.now(),a.id);
  assert.equal((await f.request('/api/session',a)).body.user,null);
  const invite=await f.request('/api/admin/invites',{method:'POST',...f.owner,data:{email:'member@example.test',emailVerifiedByOwner:true,durationDays:30}});
  const renewed=await f.request('/api/auth/activate',{method:'POST',data:{email:'member@example.test',password:PASSWORD,displayName:'Membre',acceptTerms:true,code:invite.body.code}});assert.equal(renewed.status,200);assert.equal(renewed.body.user.id,a.id);assert.equal((await f.request('/api/session',{cookie:renewed.cookie})).body.user.id,a.id);assert.equal(f.db.prepare('SELECT count(*) n FROM security_users WHERE id=?').get(a.id).n,1);f.db.close();
});
test('publication consent is separate, revocable and ownership checked',async()=>{
  const f=await fixture(),a=await f.member('a@example.test'),b=await f.member('b@example.test');const feedback=await f.request('/api/feedback',{method:'POST',...a,data:{category:'avis',body:'Un retour privé de test.',publicationConsent:true}});
  const mine=await f.request('/api/feedback',a);assert.equal(mine.body.entries[0].publication_consent,1);
  assert.equal((await f.request(`/api/feedback/${feedback.body.id}`,{method:'PATCH',...b,data:{publicationConsent:false}})).status,404);
  assert.equal((await f.request(`/api/feedback/${feedback.body.id}`,{method:'PATCH',...a,data:{publicationConsent:false}})).status,200);
  assert.equal((await f.request('/api/feedback',a)).body.entries[0].publication_consent,0);assert(f.db.prepare('SELECT withdrawn_at FROM security_consents WHERE purpose=?').get('feedback_publication:'+feedback.body.id).withdrawn_at);f.db.close();
});
test('owner can complete a strongly verified deletion request through the purge hook',async()=>{
  const f=await fixture(),a=await f.member();const requested=await f.request('/api/privacy/delete-request',{method:'POST',...a,data:{password:PASSWORD}});assert.equal(requested.status,202);
  assert.equal((await f.request('/api/admin/deletion-requests',a)).status,403);assert.equal((await f.request('/api/admin/deletion-requests',f.owner)).body.entries[0].user_id,a.id);
  const completed=await f.request(`/api/admin/deletion-requests/${requested.body.id}/complete`,{method:'POST',...f.owner,data:{confirm:'SUPPRIMER'}});assert.equal(completed.status,200);assert.deepEqual(f.purged,[a.id]);assert.equal((await f.request('/api/session',a)).body.user,null);f.db.close();
});
test('FAQ ordering and archiving affect only published client entries',async()=>{
  const f=await fixture();
  const one=await f.request('/api/admin/faq',{method:'POST',...f.owner,data:{question:'Première question ?',answer:'Une réponse factuelle.',published:true,sortOrder:20}});
  const two=await f.request('/api/admin/faq',{method:'POST',...f.owner,data:{question:'Seconde question ?',answer:'Une autre réponse.',published:true,sortOrder:10}});
  assert.deepEqual((await f.request('/api/faq')).body.entries.map(x=>x.id),[two.body.id,one.body.id]);
  await f.request('/api/admin/faq',{method:'PATCH',...f.owner,data:{id:one.body.id,question:'Première question ?',answer:'Une réponse factuelle.',published:true,sortOrder:0}});
  await f.request('/api/admin/faq',{method:'PATCH',...f.owner,data:{id:two.body.id,question:'Seconde question ?',answer:'Une autre réponse.',published:false}});
  assert.deepEqual((await f.request('/api/faq')).body.entries.map(x=>x.id),[one.body.id]);f.db.close();
});
test('expired and revoked invitation codes fail with auditable generic denial',async()=>{
  const f=await fixture(),a=await f.member();const expired=await f.request('/api/admin/invites',{method:'POST',...f.owner,data:{durationDays:7}});f.db.prepare('UPDATE security_invites SET expires_at=? WHERE id=?').run(f.now(),expired.body.id);
  const r=await f.request('/api/gifts/redeem',{method:'POST',...a,data:{code:expired.body.code}});assert.equal(r.status,400);assert.equal(r.body.code,'invalid_invite');
  const revoked=await f.request('/api/admin/invites',{method:'POST',...f.owner,data:{durationDays:null}});await f.request(`/api/admin/invites/${revoked.body.id}/revoke`,{method:'POST',...f.owner,data:{}});
  assert.equal((await f.request('/api/gifts/redeem',{method:'POST',...a,data:{code:revoked.body.code}})).body.code,'invalid_invite');assert(f.db.prepare("SELECT count(*) n FROM security_audit WHERE action='invite.redeem' AND result='denied'").get().n>=2);f.db.close();
});
test('feedback rejects blank, overlong, executable HTML and repeated spam',async()=>{
  const f=await fixture(),a=await f.member();for(const body of ['', 'a'.repeat(5001),'<script>alert(1)</script>'])assert.equal((await f.request('/api/feedback',{method:'POST',...a,data:{category:'bug',body}})).status,400);
  for(let i=0;i<5;i++)assert.equal((await f.request('/api/feedback',{method:'POST',...a,data:{category:'avis',body:'Message de test répété.'}})).status,201);
  assert.equal((await f.request('/api/feedback',{method:'POST',...a,data:{category:'avis',body:'Message de test répété.'}})).status,429);f.db.close();
});
test('admin status distinguishes revoked/expired accounts and external admin routes remain owner-gated',async()=>{
  const f=await fixture(),a=await f.member(),b=await f.member('expired@example.test');
  await f.request(`/api/admin/members/${a.id}/revoke`,{method:'POST',...f.owner,data:{}});f.db.prepare('UPDATE security_grants SET expires_at=? WHERE user_id=?').run(f.now(),b.id);
  const listed=(await f.request('/api/admin/members',f.owner)).body.members;assert.equal(listed.find(x=>x.id===a.id).access_status,'revoked');assert.equal(listed.find(x=>x.id===b.id).access_status,'expired');
  // The test harness returns404 for fallthrough, not an exception from security.
  const delegated=await f.request('/api/admin/method-versions',f.owner);assert.equal(delegated.status,404);assert.equal(delegated.body,undefined);
  const c=await f.member('active@example.test');assert.equal((await f.request('/api/admin/method-versions',c)).status,403);f.db.close();
});
