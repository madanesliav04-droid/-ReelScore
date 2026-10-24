import test from 'node:test';
import assert from 'node:assert/strict';
import {privateIPv4,validateLocalConfig} from './windows-local.mjs';
const interfaces={wifi:[{address:'192.168.1.25',internal:false}],loopback:[{address:'127.0.0.1',internal:true}]};
test('local HTTPS binds only an assigned RFC1918 address and fixed port',()=>{
 for(const ip of ['0.0.0.0','127.0.0.1','8.8.8.8','169.254.1.1','172.32.0.1','192.168.0.999','192.168.1.1.evil','::'])assert.equal(privateIPv4(ip),false,ip);
 for(const ip of ['10.0.0.1','192.168.1.25','172.16.1.2','172.31.255.1'])assert.equal(privateIPv4(ip),true,ip);
 assert.equal(validateLocalConfig({ip:'192.168.1.25',port:8443},interfaces),'https://192.168.1.25:8443');
 assert.throws(()=>validateLocalConfig({ip:'192.168.1.26',port:8443},interfaces),/changé/);
 assert.throws(()=>validateLocalConfig({ip:'192.168.1.25',port:443},interfaces),/8443/);
 assert.throws(()=>validateLocalConfig({ip:'0.0.0.0',port:8443},interfaces),/privée/);
});
