import {createPatientQrController,renderPatientQr,icon} from './patient.js';
const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const hospital=id=>({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id]||id||'확인 필요');
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR'):'확인 필요';
export function ticketConsentUsable(c,now=Date.now()) {return Boolean(c?.status==='ACTIVE'&&Date.parse(c.validFrom)<=now&&now<Date.parse(c.validUntil)&&c.scopes?.some(s=>s.allowed!==false));}
export function ticketDetails(c,studies=[]) {
  if(!c)return [];
  const scopes=c.scopes?.filter(s=>s.allowed!==false)||[];
  return [['받는 병원',hospital(c.targetHospitalId)],['제공 병원',hospital(c.sourceHospitalId)],
    ['공유 검사',scopes.map(s=>studies.find(r=>r.studyInstanceUid===s.studyInstanceUid)?.description||'등록된 의료영상').filter((v,i,a)=>a.indexOf(v)===i).join(', ')||'확인 필요'],
    ['검사 범위',`${new Set(scopes.map(s=>s.studyInstanceUid)).size}개 검사 · ${scopes.some(s=>s.seriesInstanceUid)?'선택한 시리즈':'검사 전체'}`],
    ['공유 목적',({TREATMENT:'진료',TRANSFER:'전원',REFERRAL:'전원',SECOND_OPINION:'의견 상담',RESEARCH:'연구'}[c.purpose]||c.purpose||'확인 필요')],
    ['허용 작업',c.permission==='DOWNLOAD_ALLOWED'?'영상 열람 · 다운로드 허용':c.permission==='VIEW_ONLY'?'영상 열람만 · 다운로드 불가':'확인 필요'],
    ['공유 시작',date(c.validFrom)],['공유 종료',date(c.validUntil)]];
}
export function createQrTicketSurface({root,read,readStatus,issue,navigate}) {
  let selected=null,busy=false,revision=0;
  const sheet=node('section',undefined,'patient-task-card qr-ticket-sheet');
  const back=node('button','‹ 내 지갑으로','health-wallet-back');back.type='button';back.onclick=()=>navigate('home');
  const heading=node('header',undefined,'history-heading');heading.append(node('h1','병원에 보여줄 QR'),node('p','지갑에서 꺼내 보여주세요. 내가 허용한 범위로만 연결돼요.'));
  const label=node('label','공유할 티켓 선택');label.htmlFor='qr-ticket-consent';
  const select=node('select');select.id='qr-ticket-consent';
  const ticket=node('article',undefined,'qr-ticket-paper');
  const cap=node('div',undefined,'qr-ticket-cap');cap.append(icon('qr'),node('strong','공유 QR'),node('span','1회용 병원 연결 티켓'));
  const state=node('p','공유 내용을 확인하고 있어요.');state.id='patient-qr-state';state.setAttribute('role','status');
  const qr=node('div',undefined,'qr-ticket-code');qr.id='patient-qr-code';
  const expiry=node('span','—');expiry.id='visit-packet-expiry';const expiryLine=node('p','QR 사용 기한 · ');expiryLine.append(expiry);
  const action=node('button','새 QR 발급','hp-button hp-button--primary');action.type='button';
  const note=node('p','새 QR을 발급하면 이전 미사용 QR은 사용할 수 없습니다. 공유 동의 기간은 바뀌지 않습니다.','qr-ticket-note');
  const body=node('div',undefined,'qr-ticket-center');body.append(state,qr,expiryLine,action,note);
  const details=node('section',undefined,'qr-ticket-details'),dl=node('dl');details.append(node('h2','이 QR로 공유하는 내용'),dl);
  const history=node('button','다른 공유 내역 보기','hp-button');history.type='button';history.onclick=()=>navigate('history');
  const manage=node('button','공유 관리 · 중단','hp-button');manage.type='button';manage.onclick=()=>navigate('sharing');
  const foot=node('div',undefined,'qr-ticket-actions');foot.append(history,manage);
  ticket.append(cap,body,details);sheet.append(back,heading,label,select,ticket,foot,node('p','합성 시연 데이터 · QR 접수는 영상 전송·저장 완료를 뜻하지 않습니다.','qr-ticket-note'));root.replaceChildren(sheet);
  const controller=createPatientQrController({readStatus,render:renderPatientQr});
  function refresh() {
    const {consents=[],studies=[],ready=true}=read();
    const previous=selected;
    if(!consents.some(c=>c.consentId===selected))selected=consents.find(c=>ticketConsentUsable(c))?.consentId||consents[0]?.consentId||null;
    if(previous!==selected){revision++;controller.clear();}
    select.replaceChildren();
    if(!consents.length)select.append(new Option(ready?'공유 동의가 없습니다':'공유 내용을 확인 중입니다',''));
    for(const c of consents)select.append(new Option(`${hospital(c.targetHospitalId)} · ${date(c.validUntil)} · ${ticketConsentUsable(c)?'유효':c.status==='REVOKED'?'공유 중단':'기간·상태 확인'}`,c.consentId));
    select.value=selected||'';select.disabled=busy||!ready||!consents.length;
    const consent=consents.find(c=>c.consentId===selected);dl.replaceChildren();
    for(const [key,value] of ticketDetails(consent,studies))dl.append(node('dt',key),node('dd',value));
    action.disabled=busy||!ready||!ticketConsentUsable(consent);
    if(!ready)controller.clear('최신 공유 상태를 확인해 주세요.');
    else if(!consent){controller.clear('먼저 영상을 선택하고 공유에 동의해 주세요.');dl.append(node('dd','영상 공유에서 받을 병원과 검사를 선택해 주세요.'));}
    else if(!ticketConsentUsable(consent))controller.clear('공유 기간이 지났거나 중단된 티켓입니다. 공유 내용을 확인해 주세요.');
  }
  select.onchange=()=>{selected=select.value;revision++;controller.clear('선택한 공유의 QR을 발급해 주세요.');refresh();};
  action.onclick=async()=>{
    if(busy||!ticketConsentUsable(read().consents?.find(c=>c.consentId===selected)))return;
    if(!window.confirm('새 QR을 발급할까요? 이전 미사용 QR은 무효화됩니다. 공유 동의의 범위와 기간은 그대로 유지됩니다.'))return;
    const id=selected,version=++revision;busy=true;controller.clear('새 QR을 발급하고 있어요…');action.textContent='발급 중…';refresh();
    try {const result=await issue(id);if(version===revision&&id===selected)controller.set(result,id);}
    catch {if(version===revision)controller.clear('QR을 발급하지 못했습니다. 연결과 공유 상태를 확인한 뒤 다시 시도해 주세요.');}
    finally {busy=false;action.textContent='새 QR 발급';refresh();}
  };
  return {refresh,clear:label=>{revision++;selected=null;controller.clear(label);dl.replaceChildren();select.replaceChildren();action.disabled=true;},tick:()=>controller.tick(),set:(handoff,id)=>{selected=id;refresh();if(selected===id&&read().ready!==false)controller.set(handoff,id);}};
}
