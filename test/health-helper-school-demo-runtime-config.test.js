import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSchoolDemoLanPort,SCHOOL_DEMO_LAN_PORTS} from '../src/health-helper-school-demo-runtime-config.js';

test('school demo LAN launcher defaults to the documented port and can use a spare approved port',()=>{
 assert.equal(resolveSchoolDemoLanPort(undefined),'11446');
 assert.equal(resolveSchoolDemoLanPort('11444'),'11444');
 assert.deepEqual(SCHOOL_DEMO_LAN_PORTS,['11444','11445','11446']);
});

test('school demo LAN launcher rejects unapproved ports',()=>{
 for(const value of ['11443','11447','0','http://11444',11444])
  assert.throws(()=>resolveSchoolDemoLanPort(value),/SCHOOL_DEMO_PORT_INVALID/);
});
