import {randomUUID} from 'node:crypto';

// Product help is authored content, never user activity or invented metrics.
const FAQ=[
 ['Premiers pas','Comment accéder à Social+ ?','Avec une invitation personnelle du propriétaire. Il vérifie le destinataire et transmet un code privé.'],
 ['Premiers pas','L’accès est-il payant ?','Non, pendant cette phase privée. Aucun moyen de paiement n’est demandé.'],
 ['Montage','Comment commencer un montage ?','Ouvrez Montage pour importer, enregistrer et lire votre rush. La conversion technique en MP4 H.264/AAC est disponible. Les six références artistiques indiquent leur disponibilité et les sources ou tests qui manquent ; la conversion technique ne les remplace pas.'],
 ['Stratégie','Où consulter mes analyses ?','Dans Stratégie. Les diagnostics utilisent votre profil et les mesures saisies ou importées. La revue vidéo utilise vos observations documentées ; elle ne simule pas une analyse automatique du discours et ne prédit pas la viralité.'],
 ['Problèmes techniques','Puis-je signaler un problème ?','Oui, depuis votre compte, choisissez Donner mon avis puis Signaler un problème. Les messages sont privés. Le support est aussi accessible depuis la connexion ; aucun e-mail automatique n’est envoyé.'],
 ['Mes données','Comment exporter ou supprimer mes données ?','Depuis votre compte, exportez vos données structurées et téléchargez les médias de vos projets. Un membre peut demander la suppression ou supprimer son compte après confirmation de son mot de passe. Les documents de confidentialité précisent les limites de l’installation.']
];

export function seedInitialFaq(db,now=Date.now()){
 db.exec('CREATE TABLE IF NOT EXISTS app_bootstrap(key TEXT PRIMARY KEY,completed_at INTEGER NOT NULL)');
 db.exec('BEGIN IMMEDIATE');
 try{
  if(db.prepare('SELECT key FROM app_bootstrap WHERE key=?').get('v18-initial-faq')){db.exec('COMMIT');return;}
  if(db.prepare('SELECT count(*) n FROM security_faq').get().n===0){
   const insert=db.prepare('INSERT INTO security_faq(id,question,answer,category,published,updated_at,sort_order) VALUES(?,?,?,?,1,?,?)');
   FAQ.forEach(([category,question,answer],index)=>insert.run(randomUUID(),question,answer,category,now,index));
  }
  db.prepare('INSERT INTO app_bootstrap VALUES(?,?)').run('v18-initial-faq',now);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
