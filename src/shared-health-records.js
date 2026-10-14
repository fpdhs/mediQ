import {syntheticHealthRecords,SYNTHETIC_HEALTH_VERSION} from './synthetic-health-records.js';
import {HCC_PATIENT_ID} from './capstone-hcc-catalog.js';
import {AuthError} from './auth.js';
import {HelperError} from './health-helper-rag.js';
import {sendJson} from './http-utils.js';
import {Role} from './domain.js';
export const SHARED_HEALTH_PATH='/api/v1/clinician/health-records';
export function validateHealthRecordSelection(input){
  if(input.healthRecordIds===undefined)return null;
  const ids=input.healthRecordIds;
  if(!Array.isArray(ids)||ids.length>30||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return 'HEALTH_RECORD_SCOPE_INVALID';
  if(!ids.length)return null;
  const known=new Set(syntheticHealthRecords().map(row=>row.id));
  if(input.patientId!==HCC_PATIENT_ID||input.sourceHospitalId!=='HOSP-A'||!['TREATMENT','TRANSFER','CONSULTATION'].includes(input.purpose)||ids.some(id=>!known.has(id)))return 'HEALTH_RECORD_SCOPE_INVALID';
  return null;
}
export function healthRecordScope(ids){return ids?.length?{version:SYNTHETIC_HEALTH_VERSION,ids:[...ids]}:null;}
export function authorizeSharedHealth(principal,consent,doctors,now=Date.now()){
  if(principal.role!=='DOCTOR'||!principal.doctorId||!principal.hospitalId)throw new HelperError(403,'HEALTH_RECORD_DOCTOR_REQUIRED');
  const doctor=doctors.find(d=>d.doctorId===principal.doctorId&&d.hospitalId===principal.hospitalId&&d.roles?.includes(Role.DOCTOR));
  if(!doctor)throw new HelperError(403,'DOCTOR_HOSPITAL_MISMATCH');
  if(!consent)throw new HelperError(403,'ACCESS_DENIED_NO_CONSENT');
  if(consent.targetHospitalId!==principal.hospitalId)throw new HelperError(403,'HOSPITAL_MISMATCH');
  if(consent.patientId!==HCC_PATIENT_ID||consent.sourceHospitalId!=='HOSP-A')throw new HelperError(403,'HEALTH_RECORD_SCENARIO_REQUIRED');
  if(consent.status!=='ACTIVE')throw new HelperError(403,consent.status==='REVOKED'?'CONSENT_REVOKED':'CONSENT_EXPIRED');
  if(!Number.isFinite(Date.parse(consent.validFrom))||!Number.isFinite(Date.parse(consent.validUntil))||now<Date.parse(consent.validFrom)||now>=Date.parse(consent.validUntil))throw new HelperError(403,'CONSENT_EXPIRED');
  if(!['TREATMENT','TRANSFER','CONSULTATION'].includes(consent.purpose)||!['VIEW_ONLY','DOWNLOAD_ALLOWED'].includes(consent.permission))throw new HelperError(403,'PURPOSE_MISMATCH');
  if(!doctor.approvedPurposes?.includes(consent.purpose))throw new HelperError(403,'PURPOSE_MISMATCH');
  const scope=consent.healthRecordScope;
  if(scope?.version!==SYNTHETIC_HEALTH_VERSION||!Array.isArray(scope.ids)||!scope.ids.length||scope.ids.some(id=>!syntheticHealthRecords().some(r=>r.id===id)))throw new HelperError(403,'HEALTH_RECORD_SCOPE_REQUIRED');
  return syntheticHealthRecords().filter(row=>scope.ids.includes(row.id));
}
export function createSharedHealthHandler({authenticate,requestMeta,audit,consents,doctors,hospitals=()=>[],eligible,requireTrustedIngress=false,clock=Date.now}){
  return async(request,response,url)=>{
    if(url.pathname!==SHARED_HEALTH_PATH)return false;
    let principal,consentId;
    try{
      principal=await authenticate(request);
      if(requireTrustedIngress&&!requestMeta(request,principal).ingressTrusted)throw new HelperError(403,'TRUSTED_INGRESS_REQUIRED');
      if(request.method!=='GET')throw new HelperError(405,'METHOD_NOT_ALLOWED');
      if(!eligible())throw new HelperError(403,'HEALTH_RECORD_SCENARIO_REQUIRED');
      if(principal.role!=='DOCTOR'||!doctors().some(d=>d.doctorId===principal.doctorId&&d.hospitalId===principal.hospitalId&&d.roles?.includes(Role.DOCTOR)))throw new HelperError(403,'HEALTH_RECORD_DOCTOR_REQUIRED');
      const activeHospital=id=>hospitals().some(h=>h.hospitalId===id&&h.status==='ACTIVE');
      if(!activeHospital(principal.hospitalId))throw new HelperError(403,'HOSPITAL_NOT_ACTIVE');
      if([...url.searchParams.keys()].some(k=>!['consentId','purpose'].includes(k))||[...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length!==1)||request.headers['transfer-encoding']||Number(request.headers['content-length']||0)>0)throw new HelperError(422,'HEALTH_RECORD_INPUT_INVALID');
      consentId=url.searchParams.get('consentId');
      if((url.searchParams.has('consentId')&&(!consentId||consentId.length>128))||(!consentId&&url.searchParams.has('purpose')))throw new HelperError(422,'HEALTH_RECORD_INPUT_INVALID');
      const visible=()=>consents().filter(c=>{try{authorizeSharedHealth(principal,c,doctors(),clock());return activeHospital(c.sourceHospitalId)&&activeHospital(c.targetHospitalId);}catch{return false;}});
      if(!consentId){
        await audit({actorType:'DOCTOR',actorId:principal.doctorId,hospitalId:principal.hospitalId,action:'SHARED_HEALTH_RECORDS_LIST',result:'SUCCESS'});
        sendJson(response,200,{synthetic:true,clinicalUse:false,shares:visible().map(c=>({consentId:c.consentId,patientId:c.patientId,patientName:'홍길동',purpose:c.purpose,validUntil:c.validUntil,recordCount:c.healthRecordScope.ids.length}))});
      }else{
        const read=()=>{const c=consents().find(c=>c.consentId===consentId);const rows=authorizeSharedHealth(principal,c,doctors(),clock());if(!activeHospital(c.sourceHospitalId)||!activeHospital(c.targetHospitalId))throw new HelperError(403,'HOSPITAL_NOT_ACTIVE');if(url.searchParams.get('purpose')!==c.purpose)throw new HelperError(403,'PURPOSE_MISMATCH');return {c,rows};};
        read();
        await audit({actorType:'DOCTOR',actorId:principal.doctorId,hospitalId:principal.hospitalId,consentId,action:'SHARED_HEALTH_RECORDS_READ',result:'SUCCESS'});
        const {c,rows}=read();
        sendJson(response,200,{synthetic:true,clinicalUse:false,consentId,patientId:c.patientId,patientName:'홍길동',age:56,sourceHospitalId:c.sourceHospitalId,targetHospitalId:c.targetHospitalId,purpose:c.purpose,validUntil:c.validUntil,records:rows});
      }
    }catch(error){
      let status=error instanceof AuthError||error instanceof HelperError?error.statusCode:503;
      let code=error instanceof AuthError||error instanceof HelperError?error.code:'HEALTH_RECORDS_UNAVAILABLE';
      const knownConsentId=consents().some(c=>c.consentId===consentId)?consentId:undefined;
      try{await audit({actorType:principal?.role??'UNKNOWN',actorId:principal?.subject??'unauthenticated',consentId:knownConsentId,action:'SHARED_HEALTH_RECORDS_READ',result:'FAIL',reasonCode:code});}catch{status=503;code='HEALTH_RECORDS_UNAVAILABLE';}
      sendJson(response,status,{error:code});
    }
    return true;
  };
}
