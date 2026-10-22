import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const DAY = 86_400_000;
const PASSWORD_MIN = 12;
export class HttpError extends Error {
  constructor(status, code, message, extra = {}) { super(message); Object.assign(this, {status, code, ...extra}); }
}
export function sendJson(res, status, value) {
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store, private', 'x-content-type-options':'nosniff'});
  res.end(JSON.stringify(value));
}
export async function readJson(req, limit = 65_536) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'json_required', 'Format JSON requis.');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new HttpError(413,'too_large','Le formulaire est trop volumineux.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; }
  catch { throw new HttpError(400,'invalid_json','Le formulaire est invalide.'); }
}
const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
function equal(a, b) { if (typeof a !== 'string' || typeof b !== 'string') return false; const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa,bb); }
export function normalizedEmail(value) { const email = String(value || '').trim().toLowerCase(); if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400,'invalid_email','Adresse e-mail invalide.'); return email; }
function bounded(value, max, label, min = 0) { if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new HttpError(400,'invalid_field',`${label} invalide.`); return value.trim(); }
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > 256) throw new HttpError(400,'invalid_password',`Choisissez un mot de passe de ${PASSWORD_MIN} à 256 caractères.`);
  const salt = randomBytes(16).toString('hex'); const key = await scrypt(password, salt, 64, {N:32768,r:8,p:1,maxmem:64*1024*1024}); return `scrypt$${salt}$${Buffer.from(key).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [,salt,key] = String(encoded || '').split('$'); if (!salt || !key) return false;
  const candidate = await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}); return equal(Buffer.from(candidate).toString('hex'),key);
}
function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of String(value || '').replace(/\s|=/g,'').toUpperCase()) { const i = alphabet.indexOf(c); if (i < 0) throw new Error('Invalid TOTP secret'); bits += i.toString(2).padStart(5,'0'); }
  const bytes=[]; for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2)); return Buffer.from(bytes);
}
export function totpCode(seed, counter = Math.floor(Date.now()/30_000)) {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter)); const mac = createHmac('sha1',base32Decode(seed)).update(buf).digest(); const offset=mac[mac.length-1]&15;
  return ((mac.readUInt32BE(offset)&0x7fffffff)%1_000_000).toString().padStart(6,'0');
}

/** Isolated local V1 security. Existing production Supabase and gateways are not modified. */
export function createSecurity({db,config={}}) {
  const origin = new URL(config.origin || 'http://localhost:3000').origin;
  const secure = origin.startsWith('https:');
  if(config.secureCookies===true&&!secure)throw new Error('HTTPS origin required for secure production sessions');
  if (!secure && !['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname)) throw new Error('HTTPS required outside loopback');
  const cookieName = secure ? '__Host-socialplus' : 'socialplus';
  const clock = config.now || (()=>Date.now());
  const hasRoleInput=input=>['role','roles','isOwner','is_admin','admin','owner','ownerId'].some(key=>Object.hasOwn(input,key));
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS security_users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,display_name TEXT NOT NULL,email_verified_at INTEGER NOT NULL,created_at INTEGER NOT NULL,disabled_at INTEGER,totp_counter INTEGER NOT NULL DEFAULT -1,team TEXT);
    CREATE TABLE IF NOT EXISTS security_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,csrf_hash TEXT NOT NULL,csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL,mfa_at INTEGER,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS security_sessions_user ON security_sessions(user_id);
    CREATE TABLE IF NOT EXISTS security_grants(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,starts_at INTEGER NOT NULL,expires_at INTEGER,revoked_at INTEGER,created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS security_grants_user ON security_grants(user_id);
    CREATE TABLE IF NOT EXISTS security_invites(id TEXT PRIMARY KEY,code_hash TEXT NOT NULL UNIQUE,code_prefix TEXT NOT NULL,target_email TEXT,target_verified INTEGER NOT NULL DEFAULT 0,duration_days INTEGER,max_uses INTEGER NOT NULL,uses INTEGER NOT NULL DEFAULT 0,expires_at INTEGER NOT NULL,revoked_at INTEGER,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,team TEXT);
    CREATE TABLE IF NOT EXISTS security_redemptions(invite_id TEXT NOT NULL REFERENCES security_invites(id),user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,grant_id TEXT NOT NULL,redeemed_at INTEGER NOT NULL,PRIMARY KEY(invite_id,user_id));
    CREATE TABLE IF NOT EXISTS security_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,result TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS security_limits(key_hash TEXT PRIMARY KEY,count INTEGER NOT NULL,resets_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS security_faq(id TEXT PRIMARY KEY,question TEXT NOT NULL,answer TEXT NOT NULL,category TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS security_feedback(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,category TEXT NOT NULL,rating INTEGER,body TEXT NOT NULL,publication_consent INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'nouveau',owner_reply TEXT,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS security_deletion_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'requested',requested_at INTEGER NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS security_consents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,purpose TEXT NOT NULL,version TEXT NOT NULL,granted_at INTEGER NOT NULL,withdrawn_at INTEGER);
    CREATE TABLE IF NOT EXISTS security_resets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES security_users(id) ON DELETE CASCADE,code_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,used_at INTEGER);
    CREATE TABLE IF NOT EXISTS security_support(id TEXT PRIMARY KEY,user_id TEXT REFERENCES security_users(id) ON DELETE CASCADE,contact_email TEXT,contact_verified INTEGER NOT NULL DEFAULT 0,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'nouveau',owner_note TEXT,created_at INTEGER NOT NULL);`);
  if(!db.prepare('PRAGMA table_info(security_faq)').all().some(column=>column.name==='sort_order'))db.exec('ALTER TABLE security_faq ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  const audit=(actor,action,target,result='ok')=>db.prepare('INSERT INTO security_audit VALUES (?,?,?,?,?,?)').run(randomUUID(),actor,action,target||null,result,clock());
  const limit=(req,action,max=10,window=15*60_000)=>{
    const key=digest(`${action}:${req.socket?.remoteAddress || 'local'}`), now=clock(); let row=db.prepare('SELECT * FROM security_limits WHERE key_hash=?').get(key);
    if(!row || row.resets_at<=now){db.prepare('INSERT OR REPLACE INTO security_limits VALUES (?,?,?)').run(key,1,now+window);return;}
    if(row.count>=max){audit('anonymous','security.rate_limit',action,'denied');throw new HttpError(429,'rate_limited','Trop de tentatives. Réessayez plus tard.',{retryable:true});}
    db.prepare('UPDATE security_limits SET count=count+1 WHERE key_hash=?').run(key);
  };
  function checkOrigin(req) { if(req.headers.origin!==origin) throw new HttpError(403,'origin_rejected','Origine de la requête refusée.'); }
  function session(req) {
    const cookies=String(req.headers.cookie||'').split(';').map(s=>s.trim()); const raw=cookies.find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if(!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
    return db.prepare(`SELECT s.*,u.email,u.display_name,u.disabled_at,u.email_verified_at,u.team,u.created_at user_created_at FROM security_sessions s JOIN security_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(digest(raw),clock())||null;
  }
  function activeGrant(userId){return db.prepare('SELECT * FROM security_grants WHERE user_id=? AND revoked_at IS NULL AND starts_at<=? AND (expires_at IS NULL OR expires_at>?) ORDER BY expires_at IS NULL DESC,expires_at DESC LIMIT 1').get(userId,clock(),clock())||null;}
  function authenticate(req) {
    const s=session(req); if(!s || s.disabled_at || !s.email_verified_at)return null;
    const owner=s.user_id===config.ownerId; const grant=owner?null:activeGrant(s.user_id); if(!owner&&!grant)return null;
    if(owner&&(!config.ownerTotpSecret||!s.mfa_at))return null;
    return {id:s.user_id,email:s.email,display_name:s.display_name,displayName:s.display_name,role:owner?'owner':'member',isOwner:owner,team:s.team,access_expires_at:grant?.expires_at||null,csrf:s.csrf_token,mfa_verified:!!s.mfa_at};
  }
  function requireUser(req) { const user=authenticate(req); if(!user)throw new HttpError(401,'authentication_required','Connectez-vous avec un accès actif.'); return user; }
  function requireOwner(req) {let user;try{user=requireUser(req);}catch(e){audit('anonymous','security.admin_denied',null,'denied');throw e;} if(user.id!==config.ownerId||!user.mfa_verified){audit(user.id,'security.admin_denied',null,'denied');throw new HttpError(403,'owner_required','Accès réservé au propriétaire avec MFA.');}return user;}
  function checkCsrf(req) {checkOrigin(req);const s=session(req); if(!s || !equal(digest(String(req.headers['x-csrf-token']||'')),s.csrf_hash))throw new HttpError(403,'csrf_rejected','Vérification de sécurité expirée. Rechargez la page.');}
  function setSession(req,res,user,mfa=false){
    const token=secret(),csrf=secret(),now=clock(); db.prepare('INSERT INTO security_sessions VALUES (?,?,?,?,?,?,?)').run(digest(token),user.id,digest(csrf),csrf,now+DAY,mfa?now:null,now);
    res.setHeader('Set-Cookie',`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${secure?'; Secure':''}`); return {csrf};
  }
  async function provisionOwner({id,email,password,displayName='Propriétaire'}){
    if(!config.ownerId || id!==config.ownerId)throw new Error('Owner ID must match server configuration');
    if(!config.ownerTotpSecret || base32Decode(config.ownerTotpSecret).length<20)throw new Error('Owner TOTP secret must contain at least 160 bits');
    const hash=await hashPassword(password),now=clock(); db.prepare('INSERT INTO security_users (id,email,password_hash,display_name,email_verified_at,created_at) VALUES (?,?,?,?,?,?)').run(id,normalizedEmail(email),hash,bounded(displayName,80,'Nom',1),now,now); audit(id,'owner.provision',id); return id;
  }
  function createInvite(actor,input){
    if(actor.id!==config.ownerId || !actor.mfa_verified)throw new HttpError(403,'owner_required','Accès propriétaire requis.');
    const duration=Object.hasOwn(input,'durationDays')?input.durationDays:input.duration_days; if(![7,30,null].includes(duration))throw new HttpError(400,'invalid_duration','Durée : 7 jours, 30 jours ou permanente.');
    const days=input.codeExpiresDays??7;if(!Number.isInteger(days)||days<1||days>30)throw new HttpError(400,'invalid_expiry','Le code doit expirer entre 1 et 30 jours.');
    const uses=input.maxUses??1;if(!Number.isInteger(uses)||uses<1||uses>100)throw new HttpError(400,'invalid_quota','Quota invalide.');
    const email=input.email?normalizedEmail(input.email):null;
    if(email && input.emailVerifiedByOwner!==true)throw new HttpError(400,'email_attestation_required','Confirmez que vous avez vérifié cette adresse auprès du destinataire.');
    const code=secret(),id=randomUUID(),now=clock(),team=input.team?bounded(input.team,80,'Équipe'):null;
    db.prepare('INSERT INTO security_invites (id,code_hash,code_prefix,target_email,target_verified,duration_days,max_uses,expires_at,created_by,created_at,team) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id,digest(code),code.slice(0,6),email,email?1:0,duration,uses,now+days*DAY,actor.id,now,team);
    audit(actor.id,'invite.create',id); return {id,code,email,duration_days:duration,expires_at:now+days*DAY,max_uses:uses,delivery:'manual',message:'Transmettez ce code personnel uniquement à son destinataire. Il ne sera plus affiché.'};
  }
  function redeem(code,userId,email,createUser){
    db.exec('BEGIN IMMEDIATE');try{
      const now=clock(),invite=db.prepare('SELECT * FROM security_invites WHERE code_hash=?').get(digest(String(code||'')));
      if(!invite||invite.revoked_at)throw new HttpError(400,'invalid_invite','Invitation invalide, expirée ou déjà utilisée.');
      if(invite.target_email && invite.target_email!==email)throw new HttpError(400,'invalid_invite','Invitation invalide pour cette adresse.');
      const existing=db.prepare('SELECT r.grant_id,g.revoked_at,g.expires_at FROM security_redemptions r JOIN security_grants g ON g.id=r.grant_id WHERE r.invite_id=? AND r.user_id=?').get(invite.id,userId);
      if(existing && !existing.revoked_at && (existing.expires_at===null||existing.expires_at>now)){db.exec('COMMIT');return existing.grant_id;}
      if(existing)throw new HttpError(400,'invalid_invite','L’accès issu de cette invitation a expiré ou a été révoqué.');
      if(invite.expires_at<=now||invite.uses>=invite.max_uses)throw new HttpError(400,'invalid_invite','Invitation invalide, expirée ou déjà utilisée.');
      if(createUser&&(!invite.target_email||!invite.target_verified))throw new HttpError(403,'email_verification_required','Une invitation personnelle adressée à votre e-mail vérifié par le propriétaire est requise pour créer un compte.');
      createUser?.(invite);
      const grantId=randomUUID();db.prepare('INSERT INTO security_grants VALUES (?,?,?,?,?,?,?)').run(grantId,userId,now,invite.duration_days===null?null:now+invite.duration_days*DAY,null,invite.created_by,now);
      db.prepare('UPDATE security_invites SET uses=uses+1 WHERE id=?').run(invite.id);
      db.prepare('INSERT INTO security_redemptions VALUES (?,?,?,?)').run(invite.id,userId,grantId,now);
      audit(userId,'invite.redeem',invite.id);db.exec('COMMIT');return grantId;
    }catch(e){db.exec('ROLLBACK');audit(userId||'anonymous','invite.redeem',null,'denied');throw e;}
  }
  async function handle(req,res,url){
    const path=typeof url==='string'?new URL(url,origin).pathname:url.pathname,method=req.method;
    if(path==='/api/session' && method==='GET'){const user=authenticate(req);sendJson(res,200,{user,csrf:user?.csrf||null});return true;}
    if(path==='/api/support'&&method==='POST'){
      checkOrigin(req);limit(req,'public_support',3,60*60_000);const input=await readJson(req),body=bounded(input.body,5000,'Message',10),contact=input.contactEmail?normalizedEmail(input.contactEmail):null;
      if(/<\s*script\b|\bon\w+\s*=|javascript:/i.test(body))throw new HttpError(400,'unsafe_content','Le message doit contenir uniquement du texte, sans code exécutable.');
      const user=authenticate(req),id=randomUUID();db.prepare('INSERT INTO security_support (id,user_id,contact_email,body,created_at) VALUES (?,?,?,?,?)').run(id,user?.id||null,contact,body,clock());
      sendJson(res,201,{id,status:'nouveau',contact_verified:false,message:'Message transmis au propriétaire. Aucun e-mail automatique envoyé.'});return true;
    }
    if(path==='/api/auth/login' && method==='POST'){
      checkOrigin(req);limit(req,'login');const input=await readJson(req),email=normalizedEmail(input.email);
      const row=db.prepare('SELECT * FROM security_users WHERE email=?').get(email);
      const valid=await verifyPassword(input.password,row?.password_hash||'scrypt$00000000000000000000000000000000$'+ '0'.repeat(128));
      if(!row||!valid||row.disabled_at)throw new HttpError(401,'invalid_credentials','Adresse ou mot de passe invalide.');
      const owner=row.id===config.ownerId;if(!owner&&!activeGrant(row.id))throw new HttpError(403,'access_expired','Votre accès a expiré ou a été révoqué. Contactez le propriétaire.');
      if(owner){if(!config.ownerTotpSecret)throw new HttpError(503,'mfa_not_configured','MFA propriétaire non configuré sur ce serveur.');
        const step=Math.floor(clock()/30_000);let accepted=-1;
        for(const counter of [step-1,step,step+1])if(counter>row.totp_counter&&equal(String(input.totp||''),totpCode(config.ownerTotpSecret,counter)))accepted=counter;
        if(accepted<0)throw new HttpError(401,'mfa_required','Saisissez un nouveau code de votre application d’authentification.');
        const updated=db.prepare('UPDATE security_users SET totp_counter=? WHERE id=? AND totp_counter<?').run(accepted,row.id,accepted);
        if(updated.changes!==1)throw new HttpError(401,'mfa_replayed','Ce code a déjà été utilisé. Attendez le suivant.');
      }
      if(hasRoleInput(input))audit(row.id,'security.role_input_ignored',row.id,'denied');
      const issued=setSession(req,res,row,owner);audit(row.id,'session.login',row.id);sendJson(res,200,{...issued,user:{id:row.id,email:row.email,display_name:row.display_name,role:owner?'owner':'member'}});return true;
    }
    if(path==='/api/auth/activate' && method==='POST'){
      checkOrigin(req);limit(req,'activate');const input=await readJson(req);if(input.acceptTerms!==true)throw new HttpError(400,'terms_required','Acceptez les CGU et prenez connaissance de la confidentialité.');
      const email=normalizedEmail(input.email),name=bounded(input.displayName||'',80,'Nom',1),now=clock();
      const existing=db.prepare('SELECT * FROM security_users WHERE email=?').get(email);
      if(existing){
        if(existing.id===config.ownerId||existing.disabled_at||!await verifyPassword(input.password,existing.password_hash))throw new HttpError(401,'invalid_credentials','Compte existant : utilisez votre mot de passe actuel ou contactez le propriétaire.');
        redeem(input.code,existing.id,email);if(hasRoleInput(input))audit(existing.id,'security.role_input_ignored',existing.id,'denied');
        const issued=setSession(req,res,existing);sendJson(res,200,{...issued,user:{id:existing.id,email,display_name:existing.display_name,role:'member'}});return true;
      }
      const hash=await hashPassword(input.password),id=randomUUID();
      redeem(input.code,id,email,invite=>{
        if(db.prepare('SELECT 1 FROM security_users WHERE email=?').get(email))throw new HttpError(409,'account_exists','Connectez-vous à votre compte pour activer cette invitation.');
        db.prepare('INSERT INTO security_users (id,email,password_hash,display_name,email_verified_at,created_at,team) VALUES (?,?,?,?,?,?,?)').run(id,email,hash,name,now,now,invite.team);
        db.prepare('INSERT INTO security_consents VALUES (?,?,?,?,?,NULL)').run(randomUUID(),id,'terms','v18',now);
      });
      if(hasRoleInput(input))audit(id,'security.role_input_ignored',id,'denied');
      const issued=setSession(req,res,{id});sendJson(res,201,{...issued,user:{id,email,display_name:name,role:'member'}});return true;
    }
    if(path==='/api/auth/logout' && method==='POST'){checkCsrf(req);const s=session(req);db.prepare('DELETE FROM security_sessions WHERE token_hash=?').run(s.token_hash);res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);sendJson(res,200,{ok:true});return true;}
    if(path==='/api/auth/reset' && method==='POST'){
      checkOrigin(req);limit(req,'reset');const input=await readJson(req),email=normalizedEmail(input.email),hash=await hashPassword(input.password);
      const row=db.prepare('SELECT r.*,u.email FROM security_resets r JOIN security_users u ON u.id=r.user_id WHERE r.code_hash=? AND r.used_at IS NULL AND r.expires_at>?').get(digest(String(input.code||'')),clock());
      if(!row || row.email!==email || row.user_id===config.ownerId)throw new HttpError(400,'invalid_reset','Code de récupération invalide ou expiré.');
      db.exec('BEGIN IMMEDIATE');try{const changed=db.prepare('UPDATE security_resets SET used_at=? WHERE id=? AND used_at IS NULL').run(clock(),row.id);if(changed.changes!==1)throw new HttpError(409,'reset_used','Code déjà utilisé.');db.prepare('UPDATE security_users SET password_hash=? WHERE id=?').run(hash,row.user_id);db.prepare('DELETE FROM security_sessions WHERE user_id=?').run(row.user_id);audit(row.user_id,'password.reset',row.user_id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
      sendJson(res,200,{ok:true,message:'Mot de passe modifié. Connectez-vous de nouveau.'});return true;
    }
    if(path==='/api/gifts/redeem' && method==='POST'){checkCsrf(req);const user=requireUser(req);limit(req,'redeem');const input=await readJson(req);redeem(input.code,user.id,user.email);sendJson(res,200,{ok:true});return true;}
    if(path==='/api/faq'&&method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT id,question,answer,category,updated_at,sort_order FROM security_faq WHERE published=1 ORDER BY sort_order,category,updated_at').all()});return true;}
    if(path==='/api/feedback'){
      const user=requireUser(req);if(method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT id,category,rating,body,publication_consent,status,owner_reply,created_at FROM security_feedback WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(user.id)});return true;}
      if(method==='POST'){checkCsrf(req);limit(req,'feedback',8,60*60_000);const input=await readJson(req),category=input.category;if(!['avis','idee','bug','support'].includes(category))throw new HttpError(400,'invalid_category','Catégorie invalide.');
        const body=bounded(input.body,5000,'Message',10),rating=input.rating??null;if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))throw new HttpError(400,'invalid_rating','Note invalide.');
        if(/<\s*script\b|\bon\w+\s*=|javascript:/i.test(body))throw new HttpError(400,'unsafe_content','Le message doit contenir uniquement du texte, sans code exécutable.');
        const id=randomUUID(),now=clock();db.prepare('INSERT INTO security_feedback (id,user_id,category,rating,body,publication_consent,created_at) VALUES (?,?,?,?,?,?,?)').run(id,user.id,category,rating,body,input.publicationConsent===true?1:0,now);
        if(input.publicationConsent===true)db.prepare('INSERT INTO security_consents VALUES (?,?,?,?,?,NULL)').run(randomUUID(),user.id,`feedback_publication:${id}`,'v18',now);sendJson(res,201,{id,status:'nouveau'});return true;}
    }
    const ownFeedbackMatch=path.match(/^\/api\/feedback\/([a-f0-9-]+)$/);
    if(ownFeedbackMatch&&method==='PATCH'){
      checkCsrf(req);const user=requireUser(req),input=await readJson(req),id=ownFeedbackMatch[1];
      if(input.publicationConsent!==false)throw new HttpError(400,'withdrawal_only','Cette action permet de retirer votre accord de publication.');
      const updated=db.prepare('UPDATE security_feedback SET publication_consent=0 WHERE id=? AND user_id=?').run(id,user.id);if(updated.changes!==1)throw new HttpError(404,'not_found','Avis introuvable.');
      db.prepare('UPDATE security_consents SET withdrawn_at=? WHERE user_id=? AND purpose=? AND withdrawn_at IS NULL').run(clock(),user.id,`feedback_publication:${id}`);sendJson(res,200,{ok:true,publication_consent:false});return true;
    }
    if(path.startsWith('/api/admin/')){
      const user=requireOwner(req);if(!['GET','HEAD'].includes(method))checkCsrf(req);
      if(path==='/api/admin/members'&&method==='GET'){sendJson(res,200,{members:db.prepare(`SELECT u.id,u.email,u.display_name,u.created_at,u.disabled_at,u.team,(SELECT MAX(s.created_at) FROM security_sessions s WHERE s.user_id=u.id) last_login_at FROM security_users u ORDER BY u.created_at DESC LIMIT 500`).all().map(u=>{
        const owner=u.id===config.ownerId,grant=owner?null:activeGrant(u.id),lastGrant=owner?null:db.prepare('SELECT id,starts_at,expires_at,revoked_at,created_at FROM security_grants WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(u.id)||null;
        const accessStatus=owner?'owner':u.disabled_at?'suspended':grant?(grant.expires_at===null?'permanent':'active'):lastGrant?(lastGrant.revoked_at?'revoked':'expired'):'pending';
        return {...u,role:owner?'owner':'member',grant,last_grant:lastGrant,access_status:accessStatus};
      })});return true;}
      if(path==='/api/admin/invites' || path==='/api/admin/gift-codes' || path==='/api/admin/invites/email'){
        if(method==='POST'){sendJson(res,201,createInvite(user,await readJson(req)));return true;}
        if(method==='GET'){sendJson(res,200,{invites:db.prepare('SELECT id,code_prefix,target_email,duration_days,max_uses,uses,expires_at,revoked_at,created_at,team FROM security_invites ORDER BY created_at DESC LIMIT 500').all()});return true;}
      }
      const inviteMatch=path.match(/^\/api\/admin\/(?:invites|gift-codes)\/([a-f0-9-]+)\/revoke$/);
      if(inviteMatch&&method==='POST'){db.prepare('UPDATE security_invites SET revoked_at=? WHERE id=?').run(clock(),inviteMatch[1]);audit(user.id,'invite.revoke',inviteMatch[1]);sendJson(res,200,{ok:true});return true;}
      const memberMatch=path.match(/^\/api\/admin\/members\/([a-f0-9-]+)\/(suspend|restore|extend|revoke)$/);
      if(memberMatch&&method==='POST'){
        const [,id,action]=memberMatch;if(id===config.ownerId)throw new HttpError(400,'owner_protected','Le propriétaire est géré uniquement sur le serveur.');
        if(!db.prepare('SELECT 1 FROM security_users WHERE id=?').get(id))throw new HttpError(404,'not_found','Membre introuvable.');
        if(action==='suspend'){db.prepare('UPDATE security_users SET disabled_at=? WHERE id=?').run(clock(),id);db.prepare('DELETE FROM security_sessions WHERE user_id=?').run(id);}
        if(action==='restore')db.prepare('UPDATE security_users SET disabled_at=NULL WHERE id=?').run(id);
        if(action==='revoke'){db.prepare('UPDATE security_grants SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(clock(),id);db.prepare('DELETE FROM security_sessions WHERE user_id=?').run(id);}
        if(action==='extend'){const input=await readJson(req),days=input.durationDays;if(![7,30,null].includes(days))throw new HttpError(400,'invalid_duration','Durée invalide.');const now=clock();db.prepare('INSERT INTO security_grants VALUES (?,?,?,?,?,?,?)').run(randomUUID(),id,now,days===null?null:Math.max(now,activeGrant(id)?.expires_at||now)+days*DAY,null,user.id,now);}
        audit(user.id,`member.${action}`,id);sendJson(res,200,{ok:true});return true;
      }
      const resetMatch=path.match(/^\/api\/admin\/members\/([a-f0-9-]+)\/reset-password$/);
      if(resetMatch&&method==='POST'){
        const id=resetMatch[1];if(id===config.ownerId)throw new HttpError(403,'owner_protected','Récupération du propriétaire depuis le serveur uniquement.');
        const target=db.prepare('SELECT email FROM security_users WHERE id=?').get(id);if(!target)throw new HttpError(404,'not_found','Membre introuvable.');
        const code=secret(),now=clock();db.prepare('UPDATE security_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').run(now,id);db.prepare('INSERT INTO security_resets VALUES (?,?,?,?,NULL)').run(randomUUID(),id,digest(code),now+60*60_000);audit(user.id,'password.reset_issue',id);sendJson(res,201,{code,email:target.email,expires_at:now+60*60_000,delivery:'manual'});return true;
      }
      const grantMatch=path.match(/^\/api\/admin\/grants\/([a-f0-9-]+)\/revoke$/);if(grantMatch&&method==='POST'){db.prepare('UPDATE security_grants SET revoked_at=? WHERE id=?').run(clock(),grantMatch[1]);audit(user.id,'grant.revoke',grantMatch[1]);sendJson(res,200,{ok:true});return true;}
      if(path==='/api/admin/faq'){
        if(method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT * FROM security_faq ORDER BY sort_order,updated_at DESC').all()});return true;}
        if(['POST','PATCH'].includes(method)){const input=await readJson(req),id=input.id||randomUUID();if(!/^[a-f0-9-]{36}$/.test(id))throw new HttpError(400,'invalid_id','Identifiant invalide.');const question=bounded(input.question,250,'Question',3),answer=bounded(input.answer,5000,'Réponse',3),category=bounded(input.category||'Premiers pas',80,'Catégorie',1);
          const old=db.prepare('SELECT sort_order FROM security_faq WHERE id=?').get(id),sortOrder=input.sortOrder??input.sort_order??old?.sort_order??0;if(!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>10000)throw new HttpError(400,'invalid_order','Ordre invalide.');
          db.prepare('INSERT INTO security_faq (id,question,answer,category,published,updated_at,sort_order) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,answer=excluded.answer,category=excluded.category,published=excluded.published,updated_at=excluded.updated_at,sort_order=excluded.sort_order').run(id,question,answer,category,input.published===true?1:0,clock(),sortOrder);audit(user.id,'faq.save',id);sendJson(res,200,{id});return true;}
      }
      if(path==='/api/admin/feedback'&&method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT * FROM security_feedback ORDER BY created_at DESC LIMIT 500').all()});return true;}
      if(path==='/api/admin/support'&&method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT * FROM security_support ORDER BY created_at DESC LIMIT 200').all()});return true;}
      const supportMatch=path.match(/^\/api\/admin\/support\/([a-f0-9-]+)$/);
      if(supportMatch&&method==='PATCH'){
        const input=await readJson(req);if(!['nouveau','en cours','résolu'].includes(input.status))throw new HttpError(400,'invalid_status','Statut invalide.');const note=input.note?bounded(input.note,5000,'Note interne'):null;
        const result=db.prepare('UPDATE security_support SET status=?,owner_note=? WHERE id=?').run(input.status,note,supportMatch[1]);if(result.changes!==1)throw new HttpError(404,'not_found','Message introuvable.');audit(user.id,'support.triage',supportMatch[1]);sendJson(res,200,{ok:true});return true;
      }
      if(supportMatch&&method==='DELETE'){const result=db.prepare('DELETE FROM security_support WHERE id=?').run(supportMatch[1]);if(result.changes!==1)throw new HttpError(404,'not_found','Message introuvable.');audit(user.id,'support.delete',supportMatch[1]);sendJson(res,200,{ok:true});return true;}
      const feedbackMatch=path.match(/^\/api\/admin\/feedback\/([a-f0-9-]+)$/);if(feedbackMatch&&method==='PATCH'){const input=await readJson(req);if(!['nouveau','en cours','résolu'].includes(input.status))throw new HttpError(400,'invalid_status','Statut invalide.');const reply=input.reply?bounded(input.reply,5000,'Réponse'):null;db.prepare('UPDATE security_feedback SET status=?,owner_reply=? WHERE id=?').run(input.status,reply,feedbackMatch[1]);audit(user.id,'feedback.update',feedbackMatch[1]);sendJson(res,200,{ok:true});return true;}
      if(path==='/api/admin/audit-log'&&method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT * FROM security_audit ORDER BY created_at DESC LIMIT 200').all()});return true;}
      if(path==='/api/admin/deletion-requests'&&method==='GET'){sendJson(res,200,{entries:db.prepare('SELECT r.*,u.email,u.display_name FROM security_deletion_requests r JOIN security_users u ON u.id=r.user_id ORDER BY r.requested_at DESC LIMIT 200').all()});return true;}
      const deletionMatch=path.match(/^\/api\/admin\/deletion-requests\/([a-f0-9-]+)\/complete$/);
      if(deletionMatch&&method==='POST'){
        const input=await readJson(req),request=db.prepare('SELECT * FROM security_deletion_requests WHERE id=?').get(deletionMatch[1]);if(!request)throw new HttpError(404,'not_found','Demande introuvable.');
        if(input.confirm!=='SUPPRIMER')throw new HttpError(400,'confirmation_required','Saisissez SUPPRIMER pour confirmer.');if(request.user_id===config.ownerId)throw new HttpError(403,'owner_protected','Le propriétaire est géré depuis le serveur.');
        if(typeof config.deleteUserData!=='function')throw new HttpError(503,'deletion_unavailable','Suppression des fichiers indisponible.');
        await config.deleteUserData(request.user_id);db.prepare('DELETE FROM security_users WHERE id=?').run(request.user_id);audit(user.id,'privacy.deletion_complete',request.id);sendJson(res,200,{ok:true,status:'completed'});return true;
      }
      // Other modules (for example versioned Strategy methods) own additional
      // admin routes. Their handlers run only after this owner/MFA/CSRF gate.
      return false;
    }
    if(path==='/api/privacy/export'&&method==='GET'){
      const user=requireUser(req),profile=db.prepare('SELECT id,email,display_name,email_verified_at,created_at,team FROM security_users WHERE id=?').get(user.id);
      const additional=await config.exportUserData?.(user.id)||{};
      res.setHeader('Content-Disposition','attachment; filename="socialplus-mes-donnees.json"');
      sendJson(res,200,{exported_at:new Date(clock()).toISOString(),profile,grants:db.prepare('SELECT id,starts_at,expires_at,revoked_at FROM security_grants WHERE user_id=?').all(user.id),consents:db.prepare('SELECT purpose,version,granted_at,withdrawn_at FROM security_consents WHERE user_id=?').all(user.id),feedback:db.prepare('SELECT category,rating,body,publication_consent,status,owner_reply,created_at FROM security_feedback WHERE user_id=?').all(user.id),support:db.prepare('SELECT contact_email,body,status,created_at FROM security_support WHERE user_id=?').all(user.id),...additional});return true;
    }
    if(path==='/api/privacy/delete'&&method==='POST'){
      checkCsrf(req);const user=requireUser(req);if(user.id===config.ownerId)throw new HttpError(409,'owner_protected','Le compte propriétaire se supprime depuis le serveur.');
      const input=await readJson(req),row=db.prepare('SELECT password_hash FROM security_users WHERE id=?').get(user.id);if(input.confirm!=='SUPPRIMER'||!await verifyPassword(input.password,row.password_hash))throw new HttpError(401,'reauthentication_required','Confirmez votre mot de passe et saisissez SUPPRIMER.');
      if(typeof config.deleteUserData!=='function')throw new HttpError(503,'deletion_unavailable','La suppression complète des fichiers est indisponible. Enregistrez une demande de suppression.');
      await config.deleteUserData(user.id);db.prepare('DELETE FROM security_users WHERE id=?').run(user.id);audit(user.id,'privacy.delete',user.id);res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);sendJson(res,200,{ok:true,message:'Vos données et votre compte ont été supprimés.'});return true;
    }
    if(path==='/api/privacy/delete-request'&&method==='POST'){
      checkCsrf(req);const user=requireUser(req);if(user.id===config.ownerId)throw new HttpError(409,'owner_protected','Le compte propriétaire se supprime depuis le serveur.');
      const input=await readJson(req),row=db.prepare('SELECT password_hash FROM security_users WHERE id=?').get(user.id);if(!await verifyPassword(input.password,row.password_hash))throw new HttpError(401,'reauthentication_required','Confirmez votre mot de passe.');
      const id=randomUUID();db.prepare('INSERT INTO security_deletion_requests (id,user_id,requested_at) VALUES (?,?,?)').run(id,user.id,clock());audit(user.id,'privacy.deletion_request',id);sendJson(res,202,{id,status:'requested',message:'Demande enregistrée. Le propriétaire doit confirmer la suppression des données et fichiers associés.'});return true;
    }
    return false;
  }
  return {handle,authenticate,requireUser,requireOwner,checkCsrf,checkOrigin,provisionOwner,createInvite,activeGrant,redeem,audit,db};
}
