import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSecurity} from './security.mjs';
import {seedInitialFaq} from './bootstrap.mjs';

test('initial factual FAQ is published once and never resurrects archived owner content',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  createSecurity({db});seedInitialFaq(db,1);
  const entries=db.prepare('SELECT * FROM security_faq ORDER BY sort_order').all();
  assert.equal(entries.length,6);assert(entries.every(x=>x.published===1));
  assert.match(entries.find(x=>x.category==='Montage').answer,/conversion technique ne les remplace pas/);
  assert.match(entries.find(x=>x.category==='Stratégie').answer,/ne simule pas/);
  db.prepare('UPDATE security_faq SET question=?,published=0 WHERE id=?').run('Texte du propriétaire',entries[0].id);
  seedInitialFaq(db,2);
  assert.equal(db.prepare('SELECT question,published FROM security_faq WHERE id=?').get(entries[0].id).question,'Texte du propriétaire');
  db.exec('DELETE FROM security_faq');seedInitialFaq(db,3);
  assert.equal(db.prepare('SELECT count(*) n FROM security_faq').get().n,0);
 }finally{db.close();}
});
test('existing FAQ content is preserved at first startup',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  createSecurity({db});db.prepare('INSERT INTO security_faq VALUES(?,?,?,?,?,?,?)').run('existing','Ma question','Ma réponse','Premiers pas',0,1,9);
  seedInitialFaq(db,2);assert.equal(db.prepare('SELECT count(*) n FROM security_faq').get().n,1);
 }finally{db.close();}
});
