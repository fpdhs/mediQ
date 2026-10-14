import test from 'node:test';
import assert from 'node:assert/strict';
import {ticketConsentUsable,ticketDetails} from '../public/ui/patient-qr-ticket.js';
const c={status:'ACTIVE',validFrom:'2026-10-01',validUntil:'2026-11-01',targetHospitalId:'HOSP-C',permission:'VIEW_ONLY',purpose:'TRANSFER',scopes:[{studyInstanceUid:'1.2.3'}]};
test('ticket selection fails closed for missing, future, expired, revoked or empty scopes',()=>{
 const now=Date.parse('2026-10-13');assert.equal(ticketConsentUsable(c,now),true);
 for(const bad of [null,{...c,status:'REVOKED'},{...c,validFrom:'2027-01-01'},{...c,validUntil:'2026-10-13'},{...c,scopes:[]},{...c,scopes:[{allowed:false}]}])assert.equal(ticketConsentUsable(bad,now),false);
});
test('ticket summary follows exact recipient, scope and permission without fabricated exam',()=>{
 const rows=Object.fromEntries(ticketDetails(c,[{studyInstanceUid:'1.2.3',description:'합성 CT'}]));
 assert.equal(rows['받는 병원'],'C대학병원');assert.equal(rows['공유 검사'],'합성 CT');assert.equal(rows['공유 목적'],'전원');assert.match(rows['허용 작업'],/다운로드 불가/);
 assert.equal(ticketDetails(null).length,0);
});
