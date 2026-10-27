import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPrivate,repository} from './private-transfer.mjs';
test('private media destination refuses public repositories',()=>{
  assert.throws(()=>assertPrivate({private:false,full_name:repository}),/PRIVATE_DESTINATION/);
});
test('private media destination refuses another repository',()=>{
  assert.throws(()=>assertPrivate({private:true,full_name:'someone/else'}),/PRIVATE_DESTINATION/);
});
test('fixed private destination is accepted',()=>{
  assert.doesNotThrow(()=>assertPrivate({private:true,full_name:repository}));
});
