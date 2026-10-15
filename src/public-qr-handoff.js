import {patientPublicOrigins, PATIENT_APP_ORIGIN} from './patient-public-origins.js';

export function publicHandoffReceipt(result, env, legacyOrigin) {
  if (!result?.qr?.payload) return result;
  const origin=patientPublicOrigins(env,legacyOrigin).issuance;
  const original=new URL(result.qr.payload);
  if(!/^\/t\/[A-Za-z0-9_-]{22,128}$/.test(original.pathname)||original.search||original.hash)throw new Error('HANDOFF_PAYLOAD_INVALID');
  return {...result,qr:{...result.qr,payload:origin+original.pathname}};
}

// Input source is an audit label, never evidence of camera use or authorization.
export function isPublicQrPrincipal(principal,env) {
  return env.AUTH_MODE==='ENTRA_OIDC' && env.HIPASS_PATIENT_ISSUANCE_ORIGIN===PATIENT_APP_ORIGIN
    && principal?.doctorId==='DOC-B-01' && principal?.hospitalId==='HOSP-B';
}
export function qrInputMeta(body, principal, meta, env) {
  const mode=body.inputMethod??'UNSPECIFIED';
  if(!['UNSPECIFIED','CAMERA','MANUAL','DEMO_IMPORT'].includes(mode))throw new Error('QR_INPUT_METHOD_INVALID');
  if(mode==='DEMO_IMPORT' && !isPublicQrPrincipal(principal,env))throw new Error('QR_DEMO_NOT_ALLOWED');
  return {...meta,userAgent:`QR_INPUT:${mode}; ${String(meta.userAgent??'').slice(0,180)}`};
}
