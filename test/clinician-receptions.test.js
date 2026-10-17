import test from 'node:test';
import assert from 'node:assert/strict';
import {clinicianReceptions as readReceptions} from '../src/clinician-receptions.js';
// Storage roles use domain.Role, distinct from uppercase authenticated principal roles.
function clinicianReceptions(store,principal,now){return readReceptions({get:key=>key==='doctors'?store.get(key).map(d=>({...d,roles:d.roles.map(r=>r==='DOCTOR'?'Doctor':r)})):store.get(key)},principal,now);}
const principal={role:'DOCTOR',doctorId:'D1',hospitalId:'B'};
function fixture(){const data={doctors:[{doctorId:'D1',hospitalId:'B',roles:['DOCTOR']}],transferTickets:[{ticketId:'T1',status:'USED',usedAt:'2026-10-14T00:00:00Z',patientId:'P1',consentId:'C1',sourceHospitalId:'A',targetHospitalId:'B',redeemedDoctorId:'D1',redeemedHospitalId:'B',allowedStudyUids:['1.2'],allowedSeriesUids:['1.2.1'],nonceHash:'SECRET'}],consents:[{consentId:'C1',patientId:'P1',sourceHospitalId:'A',targetHospitalId:'B',status:'ACTIVE',validFrom:'2026-01-01',validUntil:'2027-01-01',permission:'VIEW_ONLY',purpose:'TREATMENT'}],consentScopes:[{consentId:'C1',studyInstanceUid:'1.2',allowed:true}],imagingStudies:[{patientId:'P1',sourceHospitalId:'A',studyInstanceUid:'1.2',description:'Synthetic CT',gatewayUrl:'SECRET'}]};return {data,get:key=>data[key]};}
test('persisted consumption only, actor and hospital scoped, minimal metadata',()=>{
 const s=fixture();s.data.transferTickets.push({...s.data.transferTickets[0],ticketId:'other',redeemedDoctorId:'D2'},{...s.data.transferTickets[0],ticketId:'unread',status:'ISSUED'});
 const rows=clinicianReceptions(s,principal,Date.parse('2026-10-14'));assert.equal(rows.length,1);assert.equal(rows[0].studies.length,1);assert.doesNotMatch(JSON.stringify(rows),/SECRET|nonceHash|accessToken|gatewayUrl/);
 assert.equal(rows[0].consent.scopes[0].seriesInstanceUid,'1.2.1');
 assert.equal(clinicianReceptions({...s,get:key=>key==='doctors'?[{doctorId:'D1',hospitalId:'X',roles:['DOCTOR']}]:s.get(key)}, {...principal,hospitalId:'X'}).length,0);
});
test('patient and unregistered doctor cannot read reception feed',()=>{
 assert.throws(()=>clinicianReceptions(fixture(),{role:'PATIENT',patientId:'P1'}));
 assert.throws(()=>clinicianReceptions(fixture(),{...principal,doctorId:'D2'}));
});
test('revoked, expired, future and missing consent never return study metadata',()=>{
 for(const kind of ['REVOKED','expired','future','missing']){const s=fixture();if(kind==='REVOKED')s.data.consents[0].status=kind;if(kind==='expired')s.data.consents[0].validUntil='2026-10-14';if(kind==='future')s.data.consents[0].validFrom='2027-01-01';if(kind==='missing')s.data.consents=[];const [r]=clinicianReceptions(s,principal,Date.parse('2026-10-14'));assert.equal(r.consent,null);assert.deepEqual(r.studies,[]);}
});
test('scope removal and foreign patient/source excluded',()=>{
 const s=fixture();s.data.imagingStudies.push({...s.data.imagingStudies[0],patientId:'P2'},{...s.data.imagingStudies[0],sourceHospitalId:'C'});assert.equal(clinicianReceptions(s,principal,Date.parse('2026-10-14'))[0].studies.length,1);
 s.data.consentScopes[0].allowed=false;assert.equal(clinicianReceptions(s,principal,Date.parse('2026-10-14'))[0].studies.length,0);
});
