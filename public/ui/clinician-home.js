import {clinicianDetailModel, renderClinicalActivity} from './clinician.js';

const hospital = id => ({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id] || '기관 확인 필요');
const purpose = id => ({TREATMENT:'진료',TRANSFER:'전원',CONSULTATION:'진료 상담',RESEARCH:'연구'}[id] || '목적 확인 필요');

// Display metadata only; neither consent nor this model grants pixel access.
export function clinicianHomeModel(studies, selectedUid, consentForStudy, context = {}, now = Date.now()) {
  const rows = studies.map(study => {
    const consent = consentForStudy(study.studyInstanceUid);
    const state = clinicianDetailModel(study, consent, now)[2][1];
    return {study, consent, state, attention:state !== '동의 유효 · 서버 검증 필요'};
  });
  const selected = rows.find(row => row.study.studyInstanceUid === selectedUid);
  const scopes = selected?.consent?.scopes?.filter(scope => scope.allowed !== false && scope.studyInstanceUid === selectedUid) || [];
  const series = (selected?.study?.series || []).filter(series => scopes.some(scope => !scope.seriesInstanceUid || scope.seriesInstanceUid === series.seriesInstanceUid));
  return {rows, selected, series, patient:context.patientName || '합성 환자', age:context.scenario?.age,
    attention:rows.filter(row => row.attention).length};
}

function node(tag, text, className) {
  const item=document.createElement(tag);
  if (text !== undefined) item.textContent=String(text);
  if (className) item.className=className;
  return item;
}

export function createClinicianHome(root, {onSelect, onOpen, onRefresh}) {
  if (!root) return null;
  let snapshot=null, filter='all', busy=false;
  const find=id=>root.querySelector('#'+id);
  const open=find('cq-open-viewer');
  const search=find('cq-search');
  function render() {
    if (!snapshot) return;
    const {studies,selectedUid,consentForStudy,context,logs}=snapshot;
    const model=clinicianHomeModel(studies,selectedUid,consentForStudy,context);
    find('cq-summary').textContent=`전달된 검사 ${model.rows.length}건 · 동의 확인 필요 ${model.attention}건`;
    const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows=model.rows.filter(row => (filter==='all'||row.attention) && terms.every(term =>
      [model.patient,row.study.description,row.study.modality,hospital(row.study.sourceHospitalId)].join(' ').toLowerCase().includes(term)));
    const list=find('cq-requests');list.replaceChildren();
    for (const row of rows) {
      const button=node('button',undefined,'cq-request');button.type='button';button.dataset.studyUid=row.study.studyInstanceUid;
      button.setAttribute('aria-pressed',String(row.study.studyInstanceUid===selectedUid));
      const copy=node('span',undefined,'cq-copy');
      copy.append(node('strong',model.patient),node('small',`${row.study.description || '의료영상'} · ${hospital(row.study.sourceHospitalId)}`));
      const state=node('span',row.attention?row.state:'권한 확인 필요','cq-badge');state.dataset.tone=row.attention?'attention':'pending';
      button.append(node('span',row.study.modality || 'DCM','cq-modality'),copy,state);
      button.addEventListener('click',async()=>{await onSelect(row.study.studyInstanceUid);find('cq-dossier').focus();});list.append(button);
    }
    if (!rows.length) list.append(node('p','조건에 맞는 검사가 없습니다.','cq-empty'));
    const detail=find('cq-dossier');detail.replaceChildren();detail.tabIndex=-1;
    const selected=model.selected;
    open.disabled=busy||!selected||selected.attention;
    if (!selected) {detail.append(node('h3','검사를 선택하세요.'));find('cq-series').replaceChildren();return;}
    const {study,consent,state}=selected;
    const heading=node('div',undefined,'cq-patient');
    heading.append(node('h3',model.patient),node('span',Number.isInteger(model.age)?`${model.age}세 · 합성 환자`:'합성 데이터','cq-badge'));
    const status=node('span',selected.attention?state:'동의 유효','cq-badge');status.dataset.tone=selected.attention?'attention':'good';
    heading.append(status);detail.append(heading,node('p',study.description || '의료영상','cq-study-name'));
    const route=node('div',undefined,'cq-route');
    for(const [label,value] of [['검사 보유 기관',hospital(study.sourceHospitalId)],['환자 동의',selected.attention?state:'동의 유효'],['열람 기관',hospital(consent?.targetHospitalId)]]) {
      const stop=node('div');stop.append(node('strong',value),node('small',label));route.append(stop);
    }
    detail.append(route);
    const facts=node('dl',undefined,'cq-facts');
    const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR'):'미확인';
    for(const [label,value] of [['공유 목적',purpose(consent?.purpose)],['권한',({VIEW_ONLY:'열람 전용',DOWNLOAD_ALLOWED:'열람·다운로드 허용'}[consent?.permission]||'미확인')],['허용 범위',`${model.series.length}개 Series · 서버에서 재검증`],['공유 기간',`${date(consent?.validFrom)} ~ ${date(consent?.validUntil)}`]]) {
      const pair=node('div');pair.append(node('dt',label),node('dd',value));facts.append(pair);
    }
    detail.append(facts);
    const scope=find('cq-series');scope.replaceChildren();
    if(!model.series.length) scope.append(node('p','동의된 Series 메타데이터가 없습니다. 공유 범위를 확인하세요.','cq-empty'));
    else {
      const table=node('table');const head=node('tr');for(const label of ['Series','영상 수','상태'])head.append(node('th',label));
      const thead=node('thead');thead.append(head);const tbody=node('tbody');
      for(const series of model.series) {const tr=node('tr');tr.append(node('td',series.description || series.seriesDescription || `Series ${series.seriesNumber ?? ''}`),node('td',series.instanceCount ?? series.numberOfInstances ?? '미확인'),node('td','동의 범위'));tbody.append(tr);}
      table.append(thead,tbody);scope.append(table);
    }
    renderClinicalActivity(find('cq-recent'),logs,selectedUid);
    if(!busy)find('cq-access-state').textContent='서버 검증 전 · 영상 열기 전 접근권한을 다시 확인합니다.';
  }
  search.addEventListener('input',render);
  root.querySelectorAll('[data-cq-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.cqFilter;root.querySelectorAll('[data-cq-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));render();
  }));
  find('cq-refresh').addEventListener('click',async()=>{
    try {await onRefresh();} catch {fail();}
  });
  open.addEventListener('click',async()=>{
    if(busy||open.disabled)return;busy=true;open.disabled=true;find('cq-access-state').textContent='서버에서 권한을 확인하고 있습니다.';
    try {await onOpen();} catch {find('cq-access-state').textContent='연결하지 못했습니다. 공유 상태와 서버 연결을 확인하세요.';}
    finally {busy=false;render();}
  });
  function fail() {snapshot=null;find('cq-requests').replaceChildren(node('p','최신 검사를 확인하지 못했습니다. 새로고침해 주세요.','cq-empty'));find('cq-dossier').replaceChildren();find('cq-series').replaceChildren();find('cq-recent').replaceChildren();open.disabled=true;find('cq-summary').textContent='서버 연결 확인 필요';find('cq-access-state').textContent='접근 상태 미확인';}
  return {update:value=>{snapshot=value;render();},fail,reset:fail};
}
