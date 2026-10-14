import {createEntraRedirectLogin} from './entra-auth.js';
import * as msalModule from '/vendor/msal-browser.js';

const STUDY='2.25.259656708708993797343330994179169711072';
const SERIES='2.25.18361638789025095699746776899955737977';
const SOP='2.25.41201726628454317744442406717668675255';
const HASH='6053ea5f2a01c0327fd7243f01d9f843bee0f6de6f7c958503227fdfefdc0087';
const B='https://highpass-images-b.japaneast.cloudapp.azure.com';
const $=id=>document.getElementById(id);
const config=await fetch('/api/capstone-demo/auth-config',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('AUTH_CONFIG_UNAVAILABLE');return r.json();});
const redirect=await createEntraRedirectLogin({config,msalModule,appOrigin:location.origin,pathname:location.pathname});
let clinician,consents=[],running=false,finished=false;
const status=text=>{$('status').textContent=text;};
const ready=()=>{$('run').disabled=!clinician||!consents.some(c=>c.consentId===$('consent').value)||!$('confirm').checked||running||finished;};
async function api(path,session,role,body,extra={}){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{...session.headers(role),'content-type':'application/json',...extra},
  body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const value=await response.json();if(!response.ok)throw Error(/^[A-Z0-9_]+$/.test(value.error||'')?value.error:'API_REQUEST_DENIED');return value;
}
async function loadPatient(patient){
  const rows=await api('/api/patients/'+encodeURIComponent(patient.context.patientId)+'/consents',patient,'PATIENT');
  consents=rows.filter(c=>c.status==='ACTIVE'&&c.permission==='DOWNLOAD_ALLOWED'&&c.sourceHospitalId==='HOSP-A'&&c.targetHospitalId==='HOSP-B'
   &&c.purpose==='TREATMENT'&&Date.parse(c.validFrom)<=Date.now()&&Date.parse(c.validUntil)>Date.now()
   &&c.scopes?.some(s=>s.allowed!==false&&s.studyInstanceUid===STUDY&&(!s.seriesInstanceUid||s.seriesInstanceUid===SERIES)));
  $('consent').replaceChildren(...consents.map(c=>{const o=document.createElement('option');o.value=c.consentId;o.textContent='진료 · 다운로드 허용 · '+new Date(c.validUntil).toLocaleString();return o;}));
  $('consent').disabled=!consents.length;$('scope').textContent='기존 환자 승인 동의 · 복부 CT 시리즈 · 실제 반입 대상은 영상 2번 한 건';
  status(consents.length?'다운로드 허용 동의 확인':'사용할 수 있는 다운로드 동의 없음');remember();ready();
}
function remember(){if(/^consent_[A-Za-z0-9_-]+$/.test($('consent').value))sessionStorage.setItem('highpass-single-import-consent',$('consent').value);}
async function start(role){sessionStorage.setItem('highpass-single-import-role',role);remember();status('Microsoft 인증 중');await redirect.start();}
$('patient').onclick=()=>start('PATIENT').catch(()=>status('ENTRA_LOGIN_FAILED'));
$('doctor').onclick=()=>start('DOCTOR').catch(()=>status('ENTRA_LOGIN_FAILED'));
$('confirm').onchange=ready;$('consent').onchange=()=>{remember();ready();};
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
$('run').onclick=async()=>{
 if($('run').disabled)return;
 running=true;ready();status('동의 검증 및 단기 접근토큰 발급 중');
 try{
  const consent=consents.find(c=>c.consentId===$('consent').value);
  const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',key.publicKey);
  const proof=async(method,url,token)=>{
   const header=encode(new TextEncoder().encode(JSON.stringify({typ:'dpop+jwt',alg:'ES256',jwk})));
   const claims={jti:crypto.randomUUID(),htm:method,htu:url,iat:Math.floor(Date.now()/1000)};
   if(token)claims.ath=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
   const body=header+'.'+encode(new TextEncoder().encode(JSON.stringify(claims)));
   return body+'.'+encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,new TextEncoder().encode(body)));
  };
  const issued=await api('/api/dicom-access/request',clinician,'DOCTOR',{consentId:consent.consentId,doctorId:'DOC-B-01',requestingHospitalId:'HOSP-B',
   purpose:'TREATMENT',requestedAction:'DOWNLOAD',studyInstanceUid:STUDY,seriesInstanceUid:SERIES},
   {dpop:await proof('POST',location.origin+'/api/dicom-access/request')});
  if(issued.decision!=='ALLOWED'||!issued.accessToken)throw Error('TOKEN_REQUEST_DENIED');
  status('A Gateway → 암호화 전송 → B PACS 저장·재조회 중');
  const route='/dicomweb/studies/'+STUDY+'/series/'+SERIES+'/instances/'+SOP+'/import';
  const response=await fetch(B+route,{method:'POST',headers:{authorization:'DPoP '+issued.accessToken,dpop:await proof('POST',B+route,issued.accessToken)},
   cache:'no-store',signal:AbortSignal.timeout(65000)});
  const receipt=await response.json();
  if(!response.ok)throw Error(/^[A-Z0-9_]+$/.test(receipt.error||'')?receipt.error:'IMPORT_NOT_CONFIRMED');
  if(receipt.status!=='PACS_INSTANCE_VERIFIED'||receipt.simulation!==false||receipt.destinationVerification!==true
   ||receipt.sopInstanceUid!==SOP||receipt.sha256!==HASH||receipt.bytes!==3146808)throw Error('IMPORT_RECEIPT_MISMATCH');
  finished=true;
  sessionStorage.removeItem('highpass-single-import-consent');sessionStorage.removeItem('highpass-single-import-role');
  $('receipt').textContent=JSON.stringify({status:'PASS',consentId:consent.consentId,auditSessionId:issued.auditSessionId??null,...receipt},null,2);
  status('PASS · B PACS 저장본 UID·해시 재조회 및 서버 감사 완료');
 }catch(e){$('receipt').textContent=JSON.stringify({status:'FAIL',reason:e.message});status('반입 미확인. 자동 재시도하지 않습니다.');}
 finally{running=false;ready();}
};
try{
 const session=await redirect.resume();
 if(session){
  const role=sessionStorage.getItem('highpass-single-import-role');
  if(!session.roles.includes(role))throw Error('ACCOUNT_ROLE_MISMATCH');
  if(role==='PATIENT')await loadPatient(session);
  else{
   clinician=session;
   const id=sessionStorage.getItem('highpass-single-import-consent');
   if(!id||!/^consent_[A-Za-z0-9_-]+$/.test(id))throw Error('PATIENT_CONSENT_SELECTION_REQUIRED');
   // Clinicians cannot read patient consent detail through the patient-only API.
   // The token and import endpoints independently revalidate this selected ID.
   consents=[{consentId:id}];const option=document.createElement('option');option.value=id;option.textContent='환자가 선택한 진료·다운로드 동의';
   $('consent').replaceChildren(option);$('scope').textContent='합성 복부 CT · 선택한 기존 환자 동의 · 반입 대상 영상 2번 한 건';
   $('identity').textContent='서버가 확인한 B 의료진 계정';status('의료진 인증 완료');ready();
  }
 }
}catch(e){clinician=null;status(e.message);}
