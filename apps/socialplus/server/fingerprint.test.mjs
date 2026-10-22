import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Sha256, fingerprintFile } from '../public/fingerprint.js';

test('local fingerprint matches NIST SHA-256 vectors and native digest', async () => {
  for (const bytes of [Buffer.from(''),Buffer.from('abc'),Buffer.alloc(1000000,97),randomBytes(1337)]) {
    const expected = createHash('sha256').update(bytes).digest('hex');
    assert.equal(new Sha256().update(bytes).hex(),expected);
    const chunked = new Sha256();
    for(let offset=0;offset<bytes.length;offset+=13)chunked.update(bytes.subarray(offset,offset+13));
    assert.equal(chunked.hex(),expected);
    assert.equal(await fingerprintFile(new Blob([bytes])),expected);
  }
});

test('large local files hash incrementally without WebCrypto or upload', async () => {
  const bytes=randomBytes(33*1024*1024+61);
  assert.equal(await fingerprintFile(new Blob([bytes])),createHash('sha256').update(bytes).digest('hex'));
});
