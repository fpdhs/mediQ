function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
const hospital=id=>({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id]||'공유 기관');
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR'):'확인 필요';
export function receptionConsentAvailable(row,now=Date.now()){
  const c=row?.consent;
  return row?.status==='CONSENT_ACTIVE'&&c?.status==='ACTIVE'&&Date.parse(c.validFrom)<=now&&now<Date.parse(c.validUntil);
}
export function receptionSummary(rows,now=Date.now()){
  const valid=rows.filter(row=>receptionConsentAvailable(row,now)).length;
  return {total:rows.length,valid,recheck:rows.length-valid};
}
export function createReceptionDesk(root,{read,select,navigate,active,patientLabel=id=>id,now=Date.now}){
  if(!root)return null;
  // Keep the existing metadata controller's nodes without presenting them as QR receptions.
  const legacy=el('div');legacy.hidden=true;legacy.append(...root.childNodes);root.append(legacy);
  const heading=el('header',null,'rd-heading'),title=el('div');
  title.append(el('p','RECEPTION','rd-eyebrow'),el('h2','접수 데스크'));
  const controls=el('div',null,'rd-controls'),refresh=el('button','↻','rd-button rd-refresh'),start=el('button','새 QR 접수','rd-button rd-primary');
  refresh.type=start.type='button';refresh.title='접수 내역 새로고침';refresh.setAttribute('aria-label',refresh.title);controls.append(refresh,start);heading.append(title,controls);
  const summary=el('section',null,'rd-summary');summary.setAttribute('aria-label','최근 접수 현황');
  const counters={};for(const [key,label] of [['total','QR 접수'],['valid','동의 유효'],['recheck','재확인 필요']]){
    const metric=el('div',null,`rd-metric rd-metric-${key}`),number=el('strong','—');metric.append(el('span',label),number,el('small','건'));summary.append(metric);counters[key]=number;
  }
  const art=el('img',null,'rd-summary-art');art.src='/assets/reception/medical-share-card-v1.webp';art.alt='';art.setAttribute('aria-hidden','true');art.width=210;art.height=140;summary.append(art);
  const state=el('p','접수 내역을 불러오세요.','rd-status');state.setAttribute('role','status');state.setAttribute('aria-live','polite');
  const layout=el('div',null,'rd-layout'),inbox=el('section',null,'rd-inbox'),list=el('div',null,'rd-list'),detail=el('article',null,'rd-detail');
  const searchLabel=el('label','환자 또는 검사 검색','rd-search-label'),search=el('input',null,'rd-search');search.type='search';search.placeholder='환자 · CT · MRI 검색';searchLabel.append(search);
  inbox.append(el('h3','접수 목록'),searchLabel,list);layout.append(inbox,detail);root.append(heading,summary,state,layout);
  let sequence=0,rows=[],selected=null;
  function metrics(){const counts=receptionSummary(rows,now());for(const key of Object.keys(counters))counters[key].textContent=String(counts[key]);}
  function clear(){sequence++;rows=[];selected=null;search.value='';metrics();list.replaceChildren();detail.replaceChildren();refresh.disabled=false;root.removeAttribute('aria-busy');state.textContent='접수 내역을 다시 확인해 주세요.';}
  function renderList(){
    list.replaceChildren();const query=search.value.trim().toLocaleLowerCase('ko-KR');
    const visible=rows.filter(row=>[patientLabel(row.patientId),hospital(row.sourceHospitalId),hospital(row.targetHospitalId),...(row.studies||[]).map(s=>`${s.description||''} ${s.modality||''} ${s.modality==='MR'?'MRI':''}`)].join(' ').toLocaleLowerCase('ko-KR').includes(query));
    for(const row of visible){
      const available=receptionConsentAvailable(row,now()),b=el('button',null,'rd-receipt'),top=el('div',null,'rd-receipt-top');b.type='button';b.setAttribute('aria-pressed',String(row.ticketId===selected?.ticketId));
      top.append(el('strong',patientLabel(row.patientId)),el('span',available?'✓ 동의 유효':'! 재확인 필요',`rd-badge ${available?'rd-valid':'rd-warning'}`));
      const exams=el('div',null,'rd-exam-tags');for(const modality of [...new Set((row.studies||[]).map(s=>s.modality||'영상'))])exams.append(el('span',modality==='MR'?'MRI':modality,`rd-modality ${modality==='CT'?'rd-ct':''}`));
      b.append(top,el('span',`${hospital(row.sourceHospitalId)} → ${hospital(row.targetHospitalId)}`,'rd-route'),exams,el('small',date(row.receivedAt)));b.onclick=()=>{selected=row;render();};list.append(b);
    }
    if(!visible.length)list.append(el('p',query?'검색 결과가 없습니다.':'접수된 QR이 없습니다.','rd-empty'));
  }
  function info(label,value){const pair=el('div',null,'rd-info-row');pair.append(el('dt',label),el('dd',value));return pair;}
  function render(){
    metrics();renderList();detail.replaceChildren();
    if(!selected){detail.append(el('p','공유 자료 대기 중','rd-eyebrow'),el('h3','아직 접수된 QR이 없습니다'),el('p','새 QR 접수 후 환자의 공유 자료를 확인할 수 있습니다.','rd-empty'));return;}
    const available=receptionConsentAvailable(selected,now()),head=el('header',null,'rd-detail-heading');head.append(el('p','선택한 접수','rd-eyebrow'),el('h3',patientLabel(selected.patientId)),el('span',available?'✓ 동의 유효':'! 공유 재확인 필요',`rd-badge ${available?'rd-valid':'rd-warning'}`));detail.append(head);
    detail.append(el('p',`${hospital(selected.sourceHospitalId)} → ${hospital(selected.targetHospitalId)}`,'rd-hospital-route'));
    if(!available){detail.append(el('p','동의가 만료·철회되었거나 확인되지 않습니다. 현재 열람 권한은 없습니다.','rd-warning-message'));return;}
    const c=selected.consent,infoList=el('dl',null,'rd-info');
    infoList.append(info('공유 목적',({TREATMENT:'진료',TRANSFER:'전원',CONSULTATION:'상담',RESEARCH:'연구'}[c.purpose]||'확인 필요')),info('허용 범위',c.permission==='DOWNLOAD_ALLOWED'?'조회 및 다운로드 허용':'조회 전용'),info('공유 종료',date(c.validUntil)),info('영상 수신','미확인'));detail.append(infoList,el('h4','공유 검사','rd-studies-title'));
    for(const study of selected.studies||[]){
      const item=el('section',null,'rd-study'),exam=el('div',null,'rd-study-heading'),copy=el('div');copy.append(el('h4',study.description||study.modality||'공유 검사'),el('p',study.studyDate||'검사일 확인 필요'));exam.append(el('span',study.modality==='MR'?'MRI':study.modality||'영상',`rd-modality ${study.modality==='CT'?'rd-ct':''}`),copy);item.append(exam);
      const actions=el('div',null,'rd-study-actions');
      for(const [route,text] of [['records','환자 기록 보기'],['studies','검사 선택·영상 열기']]){
        const b=el('button',text,`rd-button ${route==='studies'?'rd-primary':''}`);b.type='button';
        b.onclick=async()=>{
          const row=selected,request=sequence;
          if(!active()||!receptionConsentAvailable(row,now())){state.textContent='공유 동의를 다시 확인해 주세요.';render();return;}
          b.disabled=true;try{await select(row,study);if(request===sequence&&active())navigate(route);}catch{if(request===sequence&&active())state.textContent='선택 정보를 확인하지 못했습니다. 새로고침해 주세요.';}finally{b.disabled=false;}
        };actions.append(b);
      }item.append(actions);detail.append(item);
    }
    if(!selected.studies?.length)detail.append(el('p','현재 동의 범위에 표시할 영상검사가 없습니다.','rd-empty'));
    detail.append(el('p','접수만으로 영상 열람·전송·병원 보관이 완료되지는 않습니다. 접근 시 권한을 다시 확인합니다.','rd-note'));
  }
  async function load(){
    const request=++sequence;refresh.disabled=true;root.setAttribute('aria-busy','true');state.textContent='서버에서 접수 내역을 확인하고 있어요.';
    try{const data=await read();if(request!==sequence||!active())return;if(!Array.isArray(data.receptions))throw Error('RECEPTIONS_UNAVAILABLE');rows=data.receptions;selected=rows.find(r=>r.ticketId===selected?.ticketId)||rows[0]||null;state.textContent=`내가 확인한 QR ${rows.length}건 · 최근 최대 100건`;render();}
    catch{if(request===sequence&&active()){rows=[];selected=null;metrics();list.replaceChildren();detail.replaceChildren();state.textContent='접수 내역을 불러오지 못했습니다. 다시 시도해 주세요.';}}
    finally{if(request===sequence){refresh.disabled=false;root.removeAttribute('aria-busy');}}
  }
  search.oninput=renderList;refresh.onclick=load;start.onclick=()=>navigate('dashboard');
  return {load,clear};
}
