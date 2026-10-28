import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadSource} from '../public/media-client.js';
test('upload reports measured bytes, sends CSRF and cancels on session abort',async()=>{
 const previous=globalThis.XMLHttpRequest;let request;
 class XHR {constructor(){request=this;this.upload={};this.headers={};}open(...args){this.args=args;}setRequestHeader(k,v){this.headers[k]=v;}send(file){this.file=file;}abort(){this.onabort();}}
 globalThis.XMLHttpRequest=XHR;
 try{
  const file={name:'rush.mov',type:'video/quicktime'},progress=[];
  const result=uploadSource({projectId:'private/id',file,csrf:'test-token',onProgress:p=>progress.push(p)});
  assert.equal(request.args[1],'/api/projects/private%2Fid/source');assert.equal(request.headers['X-CSRF-Token'],'test-token');assert.equal(request.withCredentials,true);
  request.upload.onprogress({lengthComputable:true,loaded:5,total:10});assert.deepEqual(progress,[50]);
  request.status=200;request.responseText='{"project":{"id":"saved"}}';request.onload();assert.equal((await result).project.id,'saved');
  const controller=new AbortController();const aborted=uploadSource({projectId:'x',file,csrf:'x',signal:controller.signal});controller.abort();await assert.rejects(aborted,{name:'AbortError'});
  const failed=uploadSource({projectId:'x',file,csrf:'x'});request.status=413;request.responseText='{"message":"Trop volumineux","code":"UPLOAD_QUOTA"}';request.onload();await assert.rejects(failed,{status:413,code:'UPLOAD_QUOTA'});
 }finally{globalThis.XMLHttpRequest=previous;}
});
