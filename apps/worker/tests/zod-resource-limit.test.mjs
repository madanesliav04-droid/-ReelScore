import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';

test('oversized constrained collections fail before validating every element',()=>{
  let examined=0;
  const item=z.custom(value=>{examined++;return typeof value==='string';});
  const schema=z.array(item).max(2);
  const result=schema.safeParse(Array(10000).fill(42));
  assert.equal(result.success,false);
  assert.equal(examined,0);
  assert.equal(result.error.issues.length,1);
  assert.equal(result.error.issues[0].code,'too_big');
  assert.deepEqual(schema.parse(['a','b']),['a','b']);
});
