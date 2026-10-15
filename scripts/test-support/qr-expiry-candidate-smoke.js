// Runs only in a network-none candidate container with an owned tmpfs store.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {JsonStore} from '/app/src/store.js';
import {HipassService} from '/app/src/services.js';
process.env.PHR_CURSOR_SECRET=randomBytes(32).toString('hex');
process.env.PHR_REFERENCE_SECRET=randomBytes(32).toString('hex');
const checks=[];
for(const offset of [-1,0,1,'proof']) {
 let now=Date.parse('2026-06-25T10:00:00Z');
 const store=new JsonStore('/tmp/qr-boundary-'+offset+'.json');await store.load();
 const service=new HipassService(store,()=>new Date(now).toISOString(),{tokenSecret:randomBytes(32).toString('hex')});
 const request=await service.createTransferRequest({requesterDoctorId:'DOC-A-01',patientId:'P-1001',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TREATMENT',permission:'VIEW_ONLY',scopes:[{studyInstanceUid:'1.2.410.100.1.20260620.001'}]});
 const approval=await service.approveTransferRequest(request.requestId,{patientId:'P-1001',permission:'VIEW_ONLY',validUntil:'2026-06-26T10:00:00Z'});
 const deadline=Date.parse(approval.ticket.expiresAt);now=deadline+(offset==='proof'?-1:offset);
 const before=store.get('dicomAccessTokenLogs').length;
 if(offset==='proof')service.verifyIssuanceProof=async()=>{now=deadline;return {valid:true};};
 const result=await service.redeemTransferTicket(approval.nonce,{doctorId:'DOC-B-01',requestingHospitalId:'HOSP-B',studyInstanceUid:'1.2.410.100.1.20260620.001',purpose:'TREATMENT',requestedAction:'VIEW'},offset==='proof'?{dpopProof:'test-proof-marker'}:{});
 if(offset===-1){assert.equal(result.decision,'ALLOWED');assert.equal(store.get('dicomAccessTokenLogs').length,before+1);}
 else {
  assert.equal(result.decision,'DENIED');assert.equal(result.reasonCode,'TICKET_EXPIRED');assert.equal(result.accessToken,undefined);
  assert.equal(store.get('dicomAccessTokenLogs').length,before);
  const ticket=store.get('transferTickets').find(t=>t.ticketId===approval.ticketId);
  assert.equal(ticket.usedAt,null);assert.notEqual(ticket.status,'USED');
  assert.ok(store.get('auditLogs').some(a=>a.ticketId===approval.ticketId&&a.action==='TICKET_DENIED'&&a.reason==='TICKET_EXPIRED'));
 }
 checks.push({test:offset==='proof'?'EXPIRES_DURING_PROOF':'EXPIRY_OFFSET_'+offset,status:'PASS'});
}
console.log(JSON.stringify({status:'PASS',scope:'ISOLATED_CANDIDATE_JSON_STORE_NOT_DEPLOYED_API_OR_REAL_DPOP',checks}));
