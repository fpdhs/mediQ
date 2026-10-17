import {randomUUID} from 'node:crypto';
import {AuthError} from './auth.js';
import {HelperError} from './health-helper-rag.js';
import {sendJson} from './http-utils.js';
import {syntheticHealthRecords,SYNTHETIC_HEALTH_VERSION} from './synthetic-health-records.js';
import {scenarioHealthStandard} from './scenario-health-standard.js';
export const SYNTHETIC_HEALTH_PATH='/api/v1/me/health-records/synthetic';
export const STANDARD_HEALTH_PATH='/api/v1/me/health-records/standard';
export function createSyntheticHealthHandler({authenticate,requestMeta,audit,eligible,studies,requireTrustedIngress=false}){
  return async(request,response,url)=>{
    if(![SYNTHETIC_HEALTH_PATH,STANDARD_HEALTH_PATH].includes(url.pathname))return false;
    let principal; const auditSessionId=randomUUID();
    try{
      principal=await authenticate(request);
      if(requireTrustedIngress&&!requestMeta(request,principal).ingressTrusted)throw new HelperError(403,'TRUSTED_INGRESS_REQUIRED');
      if(principal.role!=='PATIENT')throw new HelperError(403,'HEALTH_RECORD_PATIENT_REQUIRED');
      if(request.method!=='GET')throw new HelperError(405,'METHOD_NOT_ALLOWED');
      if(url.search||request.headers['content-length']&&request.headers['content-length']!=='0'||request.headers['transfer-encoding'])throw new HelperError(422,'HEALTH_RECORD_INPUT_INVALID');
      if(!eligible(principal))throw new HelperError(403,'HEALTH_RECORD_SCENARIO_REQUIRED');
      const records=syntheticHealthRecords();
      const standard=url.pathname===STANDARD_HEALTH_PATH ? scenarioHealthStandard(records,await studies?.(principal)) : {};
      await audit({actorType:'PATIENT',actorId:principal.subject,action:'SYNTHETIC_HEALTH_RECORDS_READ',result:'SUCCESS',reasonCode:url.pathname===STANDARD_HEALTH_PATH?'SCENARIO_HEALTH_STANDARD_DELIVERED':'SYNTHETIC_HEALTH_RECORDS_DELIVERED',auditSessionId});
      sendJson(response,200,{version:SYNTHETIC_HEALTH_VERSION,synthetic:true,clinicalUse:false,records,...standard});
    }catch(error){
      let status=error instanceof AuthError||error instanceof HelperError?error.statusCode:503;
      let code=error instanceof AuthError||error instanceof HelperError?error.code:'HEALTH_RECORDS_UNAVAILABLE';
      try{await audit({actorType:principal?.role??'UNKNOWN',actorId:principal?.subject??'unauthenticated',action:'SYNTHETIC_HEALTH_RECORDS_READ',result:'FAIL',reasonCode:code,auditSessionId});}catch{status=503;code='HEALTH_RECORDS_UNAVAILABLE';}
      sendJson(response,status,{error:code});
    }
    return true;
  };
}
