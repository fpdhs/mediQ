import {icon,patientPassState} from './patient.js';
import {libraryHospital,libraryStudy} from './patient-library.js';
import {sharingConsentModel} from './patient-sharing.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR'):'시각 확인 필요';
const action=(text,run,cls='btn')=>{const n=el('button',cls,text);n.type='button';n.onclick=run;return n;};
export function historyRows(consents,studies,filter='ALL',query='',now=Date.now()) {
  const needle=query.trim().toLocaleLowerCase();
  return consents.map(consent=>({consent,...sharingConsentModel(consent,studies,now)}))
    .filter(row=>(filter==='ALL'||filter==='ACTIVE'&&row.state.state==='ACTIVE'||filter==='ENDED'&&['REVOKED','EXPIRED'].includes(row.state.state))
      && [row.title,libraryHospital(row.consent.sourceHospitalId),libraryHospital(row.consent.targetHospitalId)].join(' ').toLocaleLowerCase().includes(needle))
    .sort((a,b)=>(Date.parse(b.consent.createdAt)||Date.parse(b.consent.validFrom)||0)-(Date.parse(a.consent.createdAt)||Date.parse(a.consent.validFrom)||0));
}
export function createPatientHistory({root,onManage,onRefresh}) {
  let studies=[],consents=[],filter='ALL',query='',selected='',busy=false,signature='',closed=false;
  const list=root.querySelector('#history-list'),detail=root.querySelector('#history-detail'),search=root.querySelector('#history-search'),status=root.querySelector('#history-feedback');
  const filters=root.querySelectorAll('[data-history-filter]');
  const meta=(consent,model)=>{const dl=el('dl','history-conditions');for(const [name,value] of [['공유 목적',model.purpose],['허용 작업',model.permission],['공유 시작',date(consent.validFrom)],['공유 종료',date(consent.validUntil)]])dl.append(el('dt','',name),el('dd','',value));return dl;};
  const showDetail=row=>{
    detail.replaceChildren();detail.hidden=!row;if(!row)return;
    const {consent,state}=row;const head=el('div','history-detail-head');head.append(el('h2','','이 연결의 기록'),action('닫기',()=>{selected='';closed=true;draw();list.querySelector('button')?.focus();},'history-close'));
    detail.append(head,el('p','history-detail-title',`${libraryHospital(consent.targetHospitalId)} · ${row.title}`),el('p','history-state',state.label));
    const timeline=el('ol','history-timeline');
    for(const [title,text,confirmed] of [['공유 동의 기록',consent.createdAt?date(consent.createdAt):'승인 시각은 현재 조회 정보에서 확인할 수 없어요.',true],['병원 연결','접수 기록 연동 전입니다. 연결 여부를 확인할 수 없어요.',false],['영상 조회','열람 기록 연동 전입니다. 조회 여부를 확인할 수 없어요.',false]]){const item=el('li',confirmed?'confirmed':'unverified');item.append(el('h3','',title),el('p','',text));timeline.append(item);}
    if(state.state==='EXPIRED'||state.state==='REVOKED'){const item=el('li','confirmed');item.append(el('h3','',state.label),el('p','',state.state==='EXPIRED'?date(consent.validUntil):'중단 시각은 상세 이용 기록 연동이 필요해요.'));timeline.append(item);}
    detail.append(timeline,meta(consent,row));
    const scope=el('div','history-scope');scope.append(el('h3','','허용한 검사 범위'));
    for(const scopeRow of row.scopes){const study=studies.find(s=>s.studyInstanceUid===scopeRow.studyInstanceUid);scope.append(el('p','',`${study?libraryStudy(study).title:'검사 정보 확인 필요'} · ${scopeRow.seriesInstanceUid?'선택한 시리즈':'검사 전체'}`));}
    if(!row.scopes.length)scope.append(el('p','','범위 정보 확인 필요'));
    const manage=action('공유 조건·중단 관리',onManage);manage.disabled=busy;detail.append(scope,manage,el('p','history-footnote','공유 중단은 이후 접근을 차단합니다. 이미 허용된 방식으로 저장한 자료는 회수되지 않습니다.'));
  };
  const draw=()=>{
    const rows=historyRows(consents,studies,filter,query);list.replaceChildren();
    for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.historyFilter===filter));
    const current=rows.filter(row=>row.state.state==='ACTIVE'),other=rows.filter(row=>row.state.state!=='ACTIVE');
    if(!closed&&!rows.some(row=>row.consent.consentId===selected))selected=current[0]?.consent.consentId||rows[0]?.consent.consentId||'';
    for(const [title,items] of [['지금 유효한 공유',current],['지난 공유·확인할 기록',other]]){
      if(!items.length)continue;list.append(el('h2','history-group-title',title));let day='';
      for(const row of items){const {consent,state}=row,active=state.state==='ACTIVE';
        const stamp=consent.createdAt||consent.validFrom,label=Number.isFinite(Date.parse(stamp))?new Date(stamp).toLocaleDateString('ko-KR'):'날짜 확인 필요';
        if(!active&&label!==day){day=label;list.append(el('p','history-day',`${day} · ${consent.createdAt?'기록일':'공유 시작일'}`));}
        const card=el('article',active?'history-pass':'history-row');card.append(el('p','history-state',state.label));
        const route=el('div','history-route');route.append(icon('home'),el('strong','',libraryHospital(consent.sourceHospitalId)),el('span','history-link','→'),icon('home'),el('strong','',libraryHospital(consent.targetHospitalId)));card.append(route);
        const exam=el('div','history-exam');exam.append(icon('archive'),el('h3','',row.title));if(row.selected.length===1){const info=libraryStudy(row.selected[0]);exam.append(el('p','',`${info.date} · ${info.series}개 시리즈 · ${info.count===null?'영상 수 확인 필요':info.count+'장'}`));}card.append(exam);
        if(active)card.append(meta(consent,row),el('p','history-unverified','병원의 접수·열람 기록은 아직 연동되지 않았어요.'));
        const view=action('이 연결의 기록 보기',()=>{closed=false;selected=consent.consentId;draw();detail.querySelector('button')?.focus();},active?'btn primary':'btn');view.setAttribute('aria-expanded',String(selected===consent.consentId));card.append(view);list.append(card);
      }
    }
    if(!rows.length){list.append(el('p','history-empty',consents.length?'조건에 맞는 공유 기록이 없어요. 검색어나 필터를 바꿔보세요.':'아직 공유 기록이 없어요. 검사와 받는 병원을 선택해 새 공유를 준비하세요.'));if(!consents.length)list.append(action('새 공유 준비',onManage));}
    showDetail(rows.find(row=>row.consent.consentId===selected));
  };
  search.oninput=()=>{query=search.value;draw();};for(const button of filters)button.onclick=()=>{filter=button.dataset.historyFilter;draw();};
  const refresh=root.querySelector('#patient-receipts-refresh');refresh.onclick=async()=>{refresh.disabled=true;status.textContent='공유 기록을 확인하고 있어요.';try{await onRefresh();status.textContent='서버 동의 정보를 다시 확인했어요.';}catch{status.textContent='기록을 새로 확인하지 못했어요. 아래 정보는 마지막 조회 결과입니다.';}finally{refresh.disabled=false;}};
  return {update(nextStudies,nextConsents,pending=false){studies=nextStudies;consents=nextConsents;busy=pending;const next=JSON.stringify([studies,consents,consents.map(c=>patientPassState(c).state),busy]);if(next===signature)return;signature=next;draw();}};
}
