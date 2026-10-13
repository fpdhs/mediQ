import test from 'node:test';
import assert from 'node:assert/strict';
import {createPatientBrowserProbe} from '../scripts/lib/patient-browser-integration.js';

test('public browser probe rejects unapproved/insecure/ambiguous targets before creating runtime resources',async()=>{
  for(const publicOrigin of ['http://192.168.111.149:9443','https://localhost:3443',
    'https://192.168.111.149:9443/other','https://192.168.111.149:9443?token=forbidden'])
    await assert.rejects(createPatientBrowserProbe({publicOrigin}),/Only the approved public test ingress/);
});
