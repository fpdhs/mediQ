import {icon, patientPassState} from './patient.js';

export const libraryHospital = id => ({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'})[id] || id || '병원 정보 확인 필요';
export function libraryStudy(study) {
  const series = Array.isArray(study.series) ? study.series : [];
  const counts = series.map(row => Array.isArray(row.instances) ? row.instances.length : row.instanceCount);
  return {title: study.description?.startsWith('합성 복부 CT 시연 영상') ? '복부 CT' : study.description || '의료영상 검사',
    modality: study.modality === 'MR' ? 'MRI' : study.modality || 'DICOM',
    date: /^\d{4}-\d{2}-\d{2}$/.test(study.studyDate || '') ? study.studyDate.replaceAll('-', '.') : study.studyDate || '검사일 확인 필요',
    series: series.length, count: counts.length && counts.every(value => Number.isSafeInteger(value) && value >= 0) ? counts.reduce((a,b)=>a+b,0) : null};
}
export function filterLibrary(studies, query='', modality='ALL') {
  const needle=query.trim().toLocaleLowerCase();
  return studies.filter(study => (modality==='ALL' || (study.modality==='MR'?'MRI':study.modality)===modality)
    && [study.description,study.studyDate,study.modality,libraryHospital(study.sourceHospitalId)].some(value=>String(value||'').toLocaleLowerCase().includes(needle)));
}
const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const button=(text,action,cls='btn')=>{const el=node('button',cls,text);el.type='button';el.onclick=action;return el;};

// Presentation only. Pixels use the existing patient self-view authority, never a public illustration.
export function createPatientLibrary({root,onView,onShare,openPreview}) {
  if(!root)return null;
  let studies=[],consents=[],selected='',query='',modality='ALL',active=false,signature='',generation=0,abort,session,url,timer;
  const clear=()=>{generation++;abort?.abort();session?.close();session=undefined;clearTimeout(timer);if(url)URL.revokeObjectURL(url);url=undefined;
    const image=root.querySelector('.library-preview img');if(image){image.removeAttribute('src');image.hidden=true;}};
  const startPreview=async study=>{
    clear();const request=generation;abort=new AbortController();
    const image=root.querySelector('.library-preview img'),status=root.querySelector('.library-preview-status');
    if(!image||!status)return;status.textContent='본인 열람 권한을 확인하고 있습니다…';
    try{
      const created=await openPreview(study,abort.signal);
      if(request!==generation||!active){created.close();return;}session=created;
      const blob=await created.frame(0);
      if(request!==generation||!active)return;
      url=URL.createObjectURL(blob);image.src=url;
      let decodeTimer;try{await Promise.race([image.decode(),new Promise((_,reject)=>{decodeTimer=setTimeout(()=>reject(new Error('PREVIEW_DECODE_TIMEOUT')),5000);})]);}finally{clearTimeout(decodeTimer);}
      if(request!==generation||!active)return;image.hidden=false;status.textContent=`실제 합성 DICOM · 첫 영상 / ${created.count}장`;
      created.close();session=undefined;
      timer=setTimeout(()=>{clear();status.textContent='미리보기 열람 시간이 끝났어요. 검사를 다시 선택해 주세요.';},Math.max(0,created.expiresAt-Date.now()));
    }catch(error){if(request!==generation||!active)return;clear();status.textContent=error.message==='PATIENT_VIEWER_DENIED'?'이 계정으로 미리보기를 열 수 없어요. 다시 로그인해 주세요.':'미리보기를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
      status.append(button('다시 시도',()=>startPreview(study),'library-retry'));}
  };
  const draw=()=>{
    clear();root.replaceChildren();const filtered=filterLibrary(studies,query,modality);
    const toolbar=node('div','library-toolbar');
    const search=node('input','library-search');search.type='search';search.placeholder='검사명, 날짜 또는 병원 검색';search.value=query;search.setAttribute('aria-label','내 의료영상 검색');
    const select=node('select','library-filter');select.setAttribute('aria-label','검사 종류');
    for(const value of ['ALL',...new Set(studies.map(s=>s.modality==='MR'?'MRI':s.modality).filter(Boolean))]){const option=node('option','',value==='ALL'?'모든 검사':value);option.value=value;select.append(option);}select.value=modality;
    search.oninput=()=>{query=search.value;draw();const replacement=root.querySelector('.library-search');replacement.focus();};select.onchange=()=>{modality=select.value;draw();};
    toolbar.append(node('p','library-total',`내 검사 ${studies.length}건`),search,select);root.append(toolbar);
    if(!filtered.length){root.append(node('p','library-empty',studies.length?'검색 결과가 없어요. 다른 검색어나 검사 종류를 선택해 주세요.':'등록된 검사 정보가 없어요. 목록을 새로 확인해 주세요.'));return;}
    const study=filtered.find(s=>s.studyInstanceUid===selected)||filtered[0];selected=study.studyInstanceUid;
    if(studies.length>1){const list=node('div','library-list');list.setAttribute('aria-label','검사 선택');for(const row of filtered){const model=libraryStudy(row);const item=button('',()=>{selected=row.studyInstanceUid;draw();},'library-list-item');item.setAttribute('aria-pressed',String(row===study));
      item.append(icon('image'),node('strong','',model.title),node('span','',`${model.modality} · ${model.date} · ${libraryHospital(row.sourceHospitalId)}`));list.append(item);}root.append(list);}
    const model=libraryStudy(study),card=node('article','library-feature');const preview=node('div','library-preview');
    const image=node('img','');image.hidden=true;image.alt='선택한 합성 DICOM 검사의 승인된 첫 영상';
    preview.append(node('span','library-preview-label','합성 CT / 비진단용'),image,node('p','library-preview-status','검사를 선택하면 본인 열람 권한을 확인합니다.'));
    preview.querySelector('.library-preview-label').textContent=`합성 ${model.modality} / 비진단용`;
    const detail=node('div','library-detail');detail.append(icon('archive'),node('p','library-kicker','내가 챙겨둔 검사'),node('h2','',model.title),node('p','library-origin',libraryHospital(study.sourceHospitalId)));
    const metadata=node('dl','library-metadata');for(const [label,value] of [['검사일',model.date],['영상 구성',`${model.series}개 시리즈 · ${model.count===null?'영상 수 확인 필요':model.count+'장'}`],['자료 안내','합성 시연 영상 · 임상 사용 불가']])metadata.append(node('dt','',label),node('dd','',value));detail.append(metadata);
    const actions=node('div','library-actions');actions.append(button('영상 살펴보기',()=>onView(study),'btn primary'),button('공유 내용 확인',()=>onShare(study),'btn'));detail.append(actions,node('p','library-note','병원 공유는 내 승인이 있어야 시작됩니다.'));card.append(preview,detail);root.append(card);
    const rows=consents.filter(c=>c.scopes?.some(scope=>scope.allowed !== false && scope.studyInstanceUid===study.studyInstanceUid));
    const history=node('section','library-sharing');history.append(node('h3','','이 검사의 공유 내역'));
    if(!rows.length)history.append(node('p','','아직 공유한 내역이 없어요. 수신 병원과 범위를 확인한 뒤 승인하세요.'));
    for(const consent of rows){const state=patientPassState(consent);const line=node('div','library-sharing-row');line.dataset.state=state.state;line.append(icon('share'),node('strong','',libraryHospital(consent.targetHospitalId)),node('span','',state.label));history.append(line);}
    history.append(button('공유 내용 다시 확인',()=>onShare(study),'btn'));root.append(history);
    if(active)startPreview(study);
  };
  return {update(nextStudies,nextConsents){studies=nextStudies;consents=nextConsents;const next=JSON.stringify([studies,consents,consents.map(c=>patientPassState(c).state)]);if(next!==signature){signature=next;draw();}},
    setActive(value){if(active===value)return;active=value;if(active)draw();else clear();},destroy(){active=false;clear();root.replaceChildren();}};
}
