import test from 'node:test';import assert from 'node:assert/strict';import {httpsEntry} from './https-entry.mjs';
test('HTTPS entry keeps media/upload on backend origin and rejects credentials or untrusted destinations',()=>{
 assert.equal(httpsEntry('https://socialplus-isolated-example.up.railway.app').redirects[0].destination,'https://socialplus-isolated-example.up.railway.app/:path*');
 for(const url of ['http://example.up.railway.app','https://user:secret@example.up.railway.app','https://example.up.railway.app/private','https://example.up.railway.app?token=secret','https://example.org','https://example.up.railway.app.evil.org'])assert.throws(()=>httpsEntry(url));
});
