import {createReceptionDesk} from '/ui/clinician-reception-desk.js';
const consent={status:'ACTIVE',validFrom:'2026-01-01',validUntil:'2027-01-01',purpose:'TRANSFER',permission:'DOWNLOAD_ALLOWED'};
const row={ticketId:'SYNTHETIC-T1',patientId:'합성 환자 01',status:'CONSENT_ACTIVE',receivedAt:'2026-10-14T00:00:00Z',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',consent,studies:[{modality:'CT',description:'합성 복부 CT',studyDate:'2026.10.10'}]};
const receptions=[row,{...row,ticketId:'SYNTHETIC-T2',patientId:'합성 환자 02',consent:{...consent,permission:'VIEW_ONLY'},studies:[{modality:'MR',description:'합성 Brain MRI',studyDate:'2026.10.09'}]},{...row,ticketId:'SYNTHETIC-T3',patientId:'합성 환자 03',consent:null,status:'CONSENT_UNAVAILABLE',studies:[]}];
const desk=createReceptionDesk(document.querySelector('#clinical-home'),{read:async()=>({receptions}),active:()=>true,now:()=>Date.parse('2026-10-14'),select:async()=>{},navigate:route=>{document.title=`UI 검증 · ${route}`;}});
await desk.load();
