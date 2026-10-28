import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {createBeta} from './beta.mjs';
const DAY=86400000;
function fixture(){const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE security_users(id TEXT PRIMARY KEY);INSERT INTO security_users VALUES('owner'),('alice'),('bob');CREATE TABLE security_feedback(user_id TEXT,rating INTEGER,experience TEXT,satisfaction TEXT);CREATE TABLE studio_jobs(user_id TEXT,state TEXT);CREATE TABLE studio_projects(user_id TEXT,source_path TEXT,source_bytes INTEGER,output_bytes INTEGER);CREATE TABLE studio_signal_reports(user_id TEXT);CREATE TABLE studio_render_requests(user_id TEXT,elapsed_ms INTEGER);`);let now=Date.UTC(2026,9,25);const beta=createBeta({db,ownerId:'owner',clock:()=>now});return {db,beta,advance:n=>{now+=n*DAY;}};}
test('beta counts real stored data, excludes owner, and does not invent an empty average or return rate',()=>{
 const {db,beta}=fixture();let s=beta.summary();assert.equal(s.testers,2);assert.equal(s.feedback.average_rating,null);assert.equal(s.returnRate,null);assert.equal(s.feedbackRate,0);
 db.exec(`INSERT INTO security_feedback VALUES('alice',4,'montage','partiel'),('alice',2,'analyse','insatisfait'),('owner',5,'general','satisfait');INSERT INTO studio_jobs VALUES('alice','complete'),('bob','failed'),('owner','complete');INSERT INTO studio_projects VALUES('alice','private.mov',100,50);INSERT INTO studio_signal_reports VALUES('alice');INSERT INTO studio_render_requests VALUES('alice',1000),('bob',3000),('owner',9000);`);
 s=beta.summary();assert.equal(s.feedback.average_rating,3);assert.equal(s.feedback.respondents,1);assert.equal(s.feedbackRate,50);assert.equal(s.videosStored,1);assert.equal(s.acousticReportsStored,1);assert.equal(s.processing.average_ms,2000);assert.equal(s.renderJobs.reduce((n,x)=>n+x.count,0),2);assert.equal(s.beta.accessDays,30);db.close();
});
test('beta uses distinct UTC days, prunes its 30-day activity window and cascades member deletion',()=>{
 const {db,beta,advance}=fixture();beta.touch('owner');beta.touch('alice');beta.touch('alice');beta.touch('bob');assert.equal(db.prepare('SELECT count(*) n FROM beta_activity').get().n,2);
 advance(1);beta.touch('alice');let s=beta.summary();assert.equal(s.active7Days,2);assert.equal(s.returning30Days,1);assert.equal(s.returnRate,50);assert.equal(beta.exportData('alice').length,2);
 advance(30);s=beta.summary();assert.equal(s.active7Days,0);assert.equal(s.returnRate,null);assert.deepEqual(beta.exportData('alice'),[]);
 beta.touch('bob');db.exec("DELETE FROM security_users WHERE id='bob'");assert.deepEqual(beta.exportData('bob'),[]);db.close();
});
