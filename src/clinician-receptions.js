import {assertDoctorPrincipal,AuthError} from './auth.js';
import {Role} from './domain.js';

// A projection of persisted ticket consumption, not an access grant or an audit-log feed.
export function clinicianReceptions(store, principal, now=Date.now()) {
  assertDoctorPrincipal(principal,{doctorId:principal.doctorId,hospitalId:principal.hospitalId});
  const doctor=store.get('doctors').find(d=>d.doctorId===principal.doctorId&&d.hospitalId===principal.hospitalId&&d.roles?.includes(Role.DOCTOR));
  if(!doctor)throw new AuthError(403,'DOCTOR_HOSPITAL_MISMATCH');
  return store.get('transferTickets').filter(t=>t.status==='USED'&&t.usedAt&&t.redeemedDoctorId===principal.doctorId&&t.redeemedHospitalId===principal.hospitalId&&t.targetHospitalId===principal.hospitalId)
    .sort((a,b)=>Date.parse(b.usedAt)-Date.parse(a.usedAt)).slice(0,100).map(t=>{
      const c=store.get('consents').find(c=>c.consentId===t.consentId&&c.patientId===t.patientId&&c.sourceHospitalId===t.sourceHospitalId&&c.targetHospitalId===principal.hospitalId);
      const available=!!c&&c.status==='ACTIVE'&&Date.parse(c.validFrom)<=now&&now<Date.parse(c.validUntil);
      const scopes=available?store.get('consentScopes').filter(s=>s.consentId===c.consentId&&s.allowed!==false&&t.allowedStudyUids?.includes(s.studyInstanceUid)).flatMap(s=>{
        if(!t.allowedSeriesUids?.length)return [{studyInstanceUid:s.studyInstanceUid,seriesInstanceUid:s.seriesInstanceUid,allowed:true}];
        return t.allowedSeriesUids.filter(uid=>!s.seriesInstanceUid||s.seriesInstanceUid===uid).map(uid=>({studyInstanceUid:s.studyInstanceUid,seriesInstanceUid:uid,allowed:true}));
      }):[];
      const consent=available?{consentId:c.consentId,patientId:c.patientId,sourceHospitalId:c.sourceHospitalId,targetHospitalId:c.targetHospitalId,purpose:c.purpose,permission:c.permission,validFrom:c.validFrom,validUntil:c.validUntil,status:c.status,scopes}:null;
      return {ticketId:t.ticketId,patientId:t.patientId,consentId:t.consentId,receivedAt:t.usedAt,sourceHospitalId:t.sourceHospitalId,targetHospitalId:t.targetHospitalId,
        status:available?'CONSENT_ACTIVE':'CONSENT_UNAVAILABLE',consent,
        studies:available?store.get('imagingStudies').filter(s=>s.patientId===t.patientId&&s.sourceHospitalId===t.sourceHospitalId&&scopes.some(scope=>scope.studyInstanceUid===s.studyInstanceUid)).map(s=>({studyInstanceUid:s.studyInstanceUid,patientId:s.patientId,sourceHospitalId:s.sourceHospitalId,description:s.description,modality:s.modality,studyDate:s.studyDate})):[]};
    });
}
