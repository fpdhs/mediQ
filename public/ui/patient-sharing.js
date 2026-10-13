import {icon,patientPassState} from './patient.js';
import {libraryStudy} from './patient-library.js';
import {createWalletDock,createWalletIcon} from './wallet-home.js';
// Presentation shell only; all existing form IDs, event handlers and approval gates survive.
export function createSharingSurface(root,navigate,mobile=false){
  if(root.querySelector('.sharing-expanded-card'))return;
  root.classList.add('sharing-extracted-sheet','sharing-wallet-v2');
  const paper=document.createElement('div');paper.className='sharing-expanded-card';
  paper.append(...root.children);root.append(paper);
  const heading=paper.querySelector(mobile?'.section-title':'.page-head h1');
  if(heading){heading.replaceChildren(createWalletIcon('sharing'),document.createTextNode(mobile?'영상 공유':'어떤 영상을 어디로 공유할까요?'));}
  const intro=paper.querySelector(mobile?'.section-sub':'.page-head p');
  if(intro)intro.textContent='영상과 병원을 고르고, 공유 내용을 확인하세요.';
  if(!mobile){
    const steps=document.createElement('ol');steps.className='sharing-preparation-steps';steps.setAttribute('aria-label','공유 단계');
    ['공유 준비','내용 확인','승인·연결'].forEach((text,index)=>{const li=document.createElement('li');li.textContent=text;if(!index)li.setAttribute('aria-current','step');steps.append(li);});
    paper.querySelector('.page-head')?.append(steps);
    const title=paper.querySelector('.sharing-new h2');if(title)title.textContent='공유할 검사';
    const summary=paper.querySelector('.sharing-summary h2');if(summary)summary.textContent='공유할 내용을 확인하세요';
    const existing=paper.querySelector('.sharing-existing h2');if(existing)existing.textContent='현재 공유 중';
  }
  root.append(createWalletDock({selected:'sharing',navigate}));
}
// Configured MVP choices, not a live directory; server policy is authoritative.
export const sharingHospitals=Object.freeze([{id:'HOSP-A',name:'A대학병원'},{id:'HOSP-B',name:'B대학병원'},{id:'HOSP-C',name:'가상 병원 C'}]);
export const recipientChoices=source=>sharingHospitals.filter(row=>row.id!==source);
const hospital=id=>sharingHospitals.find(row=>row.id===id)?.name || '병원 확인 필요';
const date=value=>Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('ko-KR'):'기간 확인 필요';
const calendarDate=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}):'기간 확인 필요';
const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const button=(text,run,cls='btn')=>{const el=node('button',cls,text);el.type='button';el.onclick=run;return el;};
export function sharingDraftModel({study,target,purpose,permission,from,until},now=Date.now()) {
  const start=Date.parse(from),end=Date.parse(until);
  const valid=Boolean(study?.studyInstanceUid && recipientChoices(study.sourceHospitalId).some(row=>row.id===target)
    && ['TREATMENT','TRANSFER','CONSULTATION'].includes(purpose) && ['VIEW_ONLY','DOWNLOAD_ALLOWED'].includes(permission)
    && Number.isFinite(start) && Number.isFinite(end) && end>start && end>now);
  return {valid,purpose,permission,from,until};
}
const localDate=value=>{const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export function sharingConsentModel(consent,studies,now=Date.now()){
  const scopes=(consent.scopes||[]).filter(row=>row.allowed!==false);
  const selected=studies.filter(study=>scopes.some(row=>row.studyInstanceUid===study.studyInstanceUid));
  return {state:patientPassState(consent,now),selected,scopes,
    title:selected.length===1?libraryStudy(selected[0]).title:selected.length?`검사 ${selected.length}건`:'검사 범위 확인 필요',
    purpose:({TREATMENT:'진료',TRANSFER:'전원',CONSULTATION:'협진',RESEARCH:'연구'})[consent.purpose] || '확인 필요',
    permission:consent.permission==='VIEW_ONLY'?'영상 열람만':consent.permission==='DOWNLOAD_ALLOWED'?'열람·다운로드':'권한 확인 필요'};
}
export function createPatientSharing({root,onPrepare,onRevoke}){
  let studies=[],consents=[],signature='',busy=false;
  const current=root.querySelector('#sharing-current'),past=root.querySelector('#sharing-past'),select=root.querySelector('#sharing-study'),target=root.querySelector('#sharing-target'),prepare=root.querySelector('#sharing-prepare');
  const purpose=root.querySelector('#sharing-purpose'),permission=root.querySelector('#sharing-permission'),from=root.querySelector('#sharing-from'),until=root.querySelector('#sharing-until'),status=root.querySelector('#sharing-draft-status');
  const studyPreview=root.querySelector('#sharing-study-preview'),summaryTitle=root.querySelector('#sharing-summary-title'),permissionHint=root.querySelector('#sharing-permission-hint');
  const studyPicker=root.querySelector('#sharing-study-picker'),summaryExam=root.querySelector('#sharing-summary-exam'),summaryPeriod=root.querySelector('#sharing-summary-period'),summaryTimes=root.querySelector('#sharing-summary-times');
  const presets=root.querySelector('#sharing-period-options');
  const presetButtons=[];
  from.value=localDate(Date.now());until.value=localDate(Date.now()+7*86400000);
  const readDraft=()=>({study:studies.find(row=>row.studyInstanceUid===select.value),target:target.value,purpose:purpose.value,permission:permission.value,from:from.value,until:until.value});
  const validate=()=>{const model=sharingDraftModel(readDraft());prepare.disabled=busy||!model.valid;
    const draft=readDraft(),summary=root.querySelector('#sharing-summary-values'),route=root.querySelector('#sharing-summary-route');
    if(route)route.textContent=`${draft.study?hospital(draft.study.sourceHospitalId):'내 영상'} → ${draft.target?hospital(draft.target):'받을 병원 선택'}`;
    if(summaryTitle)summaryTitle.textContent=draft.target?`${hospital(draft.target)}에 공유할 내용`:'받는 병원을 선택해 주세요';
    if(studyPreview){studyPreview.replaceChildren();const info=draft.study?libraryStudy(draft.study):null;const text=node('span','sharing-study-identity');text.append(node('strong','',info?.title??'검사를 선택하세요'),node('span','',info?`${info.date} · ${hospital(draft.study.sourceHospitalId)}`:'등록된 검사만 공유할 수 있어요.'));studyPreview.append(icon('archive'),text,node('span','sharing-study-change','변경'));}
    if(summaryExam)summaryExam.textContent=draft.study?libraryStudy(draft.study).title:'검사를 선택하세요';
    if(summaryPeriod)summaryPeriod.textContent=`${calendarDate(draft.from)}부터 ${calendarDate(draft.until)}까지`;
    if(summaryTimes)summaryTimes.textContent=`시작: ${date(draft.from)} / 종료: ${date(draft.until)}`;
    if(permissionHint)permissionHint.textContent=draft.permission==='DOWNLOAD_ALLOWED'?'병원이 영상을 저장할 수 있어요. 저장된 자료는 공유 중단으로 회수되지 않습니다.':'다운로드는 허용하지 않아요.';
    const days=(Date.parse(until.value)-Date.parse(from.value))/86400000;
    for(const [value,control] of presetButtons){control.disabled=busy;control.setAttribute('aria-pressed',String(value===days||value===null&&![1,3,7].includes(days)));}
    if(summary){summary.replaceChildren();for(const [label,value] of [['목적',({TREATMENT:'진료',TRANSFER:'전원',CONSULTATION:'협진'})[draft.purpose]||'선택 필요'],['허용 작업',draft.permission==='DOWNLOAD_ALLOWED'?'열람·다운로드':'영상 열람'],['다운로드',draft.permission==='DOWNLOAD_ALLOWED'?'허용':'허용 안 함']])summary.append(node('dt','',label),node('dd','',value));}
    status.textContent=busy?'처리 결과를 확인하고 있어요.':!target.value?'받는 병원을 선택해 주세요.':!model.valid?'목적·허용 작업·기간을 확인하세요. 종료 시각은 시작 이후이며 현재보다 미래여야 해요.':permission.value==='DOWNLOAD_ALLOWED'?'병원이 자료를 저장할 수 있어요. 저장된 자료는 공유 중단으로 회수되지 않습니다.':'';return model;};
  for(const field of [purpose,permission,from,until]){field.oninput=validate;field.onchange=validate;}
  if(presets){for(const [days,label] of [[1,'1일'],[3,'3일'],[7,'7일'],[null,'직접 설정']]){const control=button(label,()=>{if(busy)return;if(days===null){until.focus();return;}const start=Date.parse(from.value);if(!Number.isFinite(start)){from.focus();return;}until.value=localDate(start+days*86400000);validate();},'sharing-period-button');control.setAttribute('aria-label',`공유 기간 ${label}`);presets.append(control);presetButtons.push([days,control]);}}
  const recipients=()=>{const study=studies.find(row=>row.studyInstanceUid===select.value),previous=target.value;target.replaceChildren();const empty=node('option','','받는 병원을 선택하세요');empty.value='';target.append(empty);
    for(const row of study?recipientChoices(study.sourceHospitalId):[]){const option=node('option','',row.name);option.value=row.id;target.append(option);}target.value=study&&recipientChoices(study.sourceHospitalId).some(row=>row.id===previous)?previous:'';target.disabled=busy||!study;validate();};
  select.onchange=()=>{recipients();if(studyPicker){studyPicker.open=false;studyPreview?.focus?.();}};target.onchange=validate;
  prepare.onclick=()=>{const draft=readDraft(),model=validate();if(!busy&&model.valid)onPrepare(draft.study,draft.target,model);};
  const details=(consent,model)=>{const box=node('details','sharing-details');box.append(node('summary','','공유 내용 보기'));const dl=node('dl','sharing-detail-list');
    const ranges=model.scopes.map(scope=>{const study=studies.find(row=>row.studyInstanceUid===scope.studyInstanceUid);return `${study?libraryStudy(study).title:'검사 확인 필요'} / ${scope.seriesInstanceUid?'선택 시리즈':'검사 전체'}`;}).join(', ');
    for(const [label,value] of [['받는 병원',hospital(consent.targetHospitalId)],['목적',model.purpose],['허용 작업',model.permission],['공유 시작',date(consent.validFrom)],['공유 종료',date(consent.validUntil)],['검사 범위',ranges||'확인 필요']])dl.append(node('dt','',label),node('dd','',value));
    box.append(dl,node('p','sharing-note','승인 당시의 내용입니다. 다른 병원에 공유하려면 새 승인이 필요해요.'));return box;};
  const draw=()=>{current.replaceChildren();past.replaceChildren();
    for(const consent of consents){const model=sharingConsentModel(consent,studies),active=model.state.state==='ACTIVE',card=node('article',active?'sharing-pass':'sharing-history-row'),body=node('div','sharing-pass-body');body.append(node('p','sharing-status',model.state.label));
      const route=node('h2','sharing-route');route.append(node('span','',hospital(consent.sourceHospitalId)),node('span','sharing-arrow','→'),node('span','',hospital(consent.targetHospitalId)));body.append(route);
      const exam=node('div','sharing-exam');exam.append(icon('archive'),node('h3','',model.title));if(model.selected.length===1){const info=libraryStudy(model.selected[0]);exam.append(node('p','',`${info.date} · ${info.series}개 시리즈 · ${info.count===null?'영상 수 확인 필요':info.count+'장'}`));}body.append(exam);
      const meta=node('dl','sharing-meta');for(const [label,value] of [['공유 목적',model.purpose],['허용 작업',model.permission],['공유 종료',date(consent.validUntil)]])meta.append(node('dt','',label),node('dd','',value));body.append(meta,node('p','sharing-note',consent.permission==='VIEW_ONLY'?'다운로드는 허용하지 않아요. 승인된 범위에서만 접근할 수 있어요.':'선택한 범위의 다운로드를 허용한 동의입니다.'));
      const stub=node('aside','sharing-pass-stub');stub.append(icon('shield'),node('h3','','공유는 내가 결정해요.'),node('p','','받는 병원과 이용 범위를 언제든 확인하세요.'),details(consent,model));
      if(active){const stop=button('공유 중단',()=>onRevoke(consent.consentId),'sharing-stop');stop.disabled=busy;stub.append(stop);}else{const reuse=button('새 공유 준비',()=>{const study=model.selected[0];if(!busy&&study){select.value=study.studyInstanceUid;recipients();target.value=recipientChoices(study.sourceHospitalId).some(row=>row.id===consent.targetHospitalId)?consent.targetHospitalId:'';target.onchange();if(studyPicker)studyPicker.open=true;select.focus();}});reuse.disabled=busy||!model.selected.length;stub.append(reuse);}card.append(body,stub);(active?current:past).append(card);}
    if(!current.children.length)current.append(node('p','sharing-empty','지금 유효한 공유가 없어요. 병원과 검사를 선택해 새 공유를 준비하세요.'));if(!past.children.length)past.append(node('p','sharing-empty','지난 공유 내역이 아직 없어요.'));};
  return {update(nextStudies,nextConsents,pending=false){studies=nextStudies;consents=nextConsents;busy=pending;const next=JSON.stringify([studies,consents,consents.map(c=>patientPassState(c).state),busy]);if(next===signature)return;signature=next;
    const chosen=select.value;select.replaceChildren();for(const study of studies){const option=node('option','',`${libraryStudy(study).title} · ${libraryStudy(study).date}`);option.value=study.studyInstanceUid;select.append(option);}select.value=studies.some(row=>row.studyInstanceUid===chosen)?chosen:studies[0]?.studyInstanceUid||'';select.disabled=busy||!studies.length;for(const field of [purpose,permission,from,until])field.disabled=busy;recipients();draw();}};
}
