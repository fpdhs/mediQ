const PATH='/api/v1/clinician/health-records';
const kinds={CHECKUP:'건강검진',AFP:'혈액검사',ULTRASOUND:'초음파'};
const purposes={TREATMENT:'진료',TRANSFER:'전원',CONSULTATION:'협진'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
export function compareSharedRecords(current,records){
  const previous=records.filter(r=>r.kind===current.kind&&r.date<current.date&&r.method===current.method&&r.unit===current.unit).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(!previous||!Number.isFinite(current.value)||!Number.isFinite(previous.value))return null;
  return {previous,delta:current.value-previous.value,percent:previous.value===0?null:(current.value-previous.value)/previous.value*100};
}
export function createClinicianHealth(root,{headers,available,onImages,request=fetch}){
  if(!root)return {setActive(){},reset(){}};
  let revision=0,controller,timer,shares=[],data=null,selected='',filter='ALL',query='',active=false;
  let receptionConsent=null;
  const invalidate=()=>{revision++;controller?.abort();clearTimeout(timer);};
  const status=message=>{root.replaceChildren(node('p',message,'chr-status'));};
  const button=(text,fn,cls)=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
  async function get(params,generation){
    const auth=headers()?.authorization;if(!/^Bearer \S+$/u.test(auth??''))throw Error('AUTH_REQUIRED');
    controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await request(PATH+params,{headers:{authorization:auth},signal:controller.signal,cache:'no-store',redirect:'error'});
      const text=await response.text();if(text.length>131072)throw Error('INVALID_RESPONSE');
      const result=JSON.parse(text);
      if(!response.ok||result.synthetic!==true||result.clinicalUse!==false)throw Error('ACCESS_UNAVAILABLE');
      if(generation!==revision||!active||!available())return null;
      return result;
    }finally{clearTimeout(deadline);}
  }
  async function loadShare(id){
    invalidate();const generation=revision;data=null;status('공유 범위를 확인하고 있어요.');
    const share=shares.find(s=>s.consentId===id);if(!share)return;
    try{
      const result=await get(`?consentId=${encodeURIComponent(id)}&purpose=${encodeURIComponent(share.purpose)}`,generation);
      if(!result)return;
      if(!Array.isArray(result.records)||result.records.length>30||!result.records.every(r=>r.synthetic===true&&typeof r.id==='string'&&typeof r.title==='string'&&typeof r.date==='string'))throw Error('INVALID_RESPONSE');
      data=result;selected=result.records[0]?.id??'';render();
      // Do not retain visible records beyond the server-confirmed expiry.
      timer=setTimeout(()=>{invalidate();data=null;status('공유 기간이 끝났어요. 다시 공유받아 주세요.');},Math.max(0,Math.min(Date.parse(result.validUntil)-Date.now(),2147483647)));
    }catch{if(generation===revision){data=null;status('공유 기록을 열 수 없어요. 동의·소속 병원·로그인 상태를 확인해 주세요.');root.append(button('다시 확인',load));}}
  }
  async function load(){
    invalidate();data=null;shares=[];if(!active||!available()){status('의료진 로그인이 필요해요.');return;}
    const generation=revision;status('환자가 공유한 기록을 확인하고 있어요.');
    try{
      const result=await get('',generation);if(!result)return;
      if(!Array.isArray(result.shares)||result.shares.length>10000)throw Error('INVALID_RESPONSE');shares=receptionConsent?result.shares.filter(s=>s.consentId===receptionConsent):result.shares;
      if(!shares.length){status(receptionConsent?'선택한 접수에 공유된 건강기록이 없습니다. 다른 접수의 기록으로 자동 전환하지 않습니다.':'아직 공유받은 건강기록이 없어요. 환자가 영상 공유 승인에서 건강기록을 선택해야 합니다.');return;}
      await loadShare(shares[0].consentId);
    }catch{if(generation===revision){status('공유 목록을 확인하지 못했어요.');root.append(button('다시 확인',load));}}
  }
  function render(){
    if(!data)return;root.replaceChildren();
    const header=node('header',undefined,'chr-heading');header.append(node('p','환자 기록 · 합성 시연','chr-eyebrow'),node('h1','환자가 공유한 건강기록'),node('p',`${data.patientName} · ${data.age}세 / 승인된 기록 ${data.records.length}건`));root.append(header);
    const toolbar=node('div',undefined,'chr-toolbar');
    const select=node('select');select.setAttribute('aria-label','열람할 공유 동의');
    for(const s of shares){const option=node('option',`${s.patientName} · ${purposes[s.purpose]||s.purpose} · ${s.recordCount}건`);option.value=s.consentId;option.selected=s.consentId===data.consentId;select.append(option);}select.addEventListener('change',()=>loadShare(select.value));toolbar.append(select,button('공유 범위 확인',()=>{scope.hidden=!scope.hidden;}));root.append(toolbar);
    const scope=node('p',`제공 ${data.sourceHospitalId} → 수신 ${data.targetHospitalId} · ${purposes[data.purpose]||data.purpose} · 종료 ${new Date(data.validUntil).toLocaleString('ko-KR')} · 건강기록 화면 열람`, 'chr-scope');scope.hidden=true;root.append(scope);
    const filters=node('div',undefined,'chr-filters');for(const [id,title] of [['ALL','전체'],...Object.entries(kinds)])filters.append(button(title,()=>{filter=id;render();},filter===id?'active':''));
    const search=node('input');search.type='search';search.placeholder='검사·병원 검색';search.setAttribute('aria-label','공유 기록 검색');search.value=query;
    search.addEventListener('input',()=>{query=search.value;renderList(list);});filters.append(search);root.append(filters);
    const grid=node('div',undefined,'chr-grid'),list=node('div',undefined,'chr-record-list'),detail=node('article',undefined,'chr-detail');grid.append(list,detail);root.append(grid);renderList(list);renderDetail(detail);
    root.append(button('환자·영상으로 이어보기 →',onImages,'chr-images'),node('small','합성·비임상 기록입니다. 실제 검사·판독 결과가 아니며, 공유되지 않은 기록은 표시하지 않습니다.'));
  }
  function renderList(list){
    list.replaceChildren();const rows=data.records.filter(r=>(filter==='ALL'||r.kind===filter)&&`${r.title} ${r.hospital}`.includes(query)).sort((a,b)=>b.date.localeCompare(a.date));
    if(!rows.length)list.append(node('p','조건에 맞는 공유 기록이 없어요.'));
    for(const r of rows){const b=button('',()=>{selected=r.id;render();},`chr-record${r.id===selected?' selected':''}`);b.setAttribute('aria-pressed',String(r.id===selected));b.append(node('small',kinds[r.kind]||'검사'),node('strong',r.title),node('span',`${r.date} · ${r.hospital}`));list.append(b);}
  }
  function renderDetail(detail){
    const record=data.records.find(r=>r.id===selected);if(!record){detail.append(node('p','기록을 선택해 주세요.'));return;}
    detail.append(node('p','공유받은 기록','chr-eyebrow'),node('h2',record.title),node('p',`${record.date} · ${record.hospital}`));
    if(record.kind==='AFP'){
      detail.append(node('div',`${record.value} ${record.unit}`,'chr-value'));
      const comparison=compareSharedRecords(record,data.records);
      if(comparison){const box=node('section',undefined,'chr-comparison');box.append(node('h3','이전 공유 기록과 비교'),node('p',`${comparison.previous.date} · ${comparison.previous.value} ${record.unit} → ${record.value} ${record.unit}`),node('strong',`${comparison.delta>0?'+':''}${comparison.delta.toFixed(1)} ${record.unit}${comparison.percent===null?'':` (${comparison.percent>0?'+':''}${comparison.percent.toFixed(1)}%)`}`),node('p','동일한 합성 검사 방식의 수치 차이입니다. 증가율은 진단이나 질환의 진행 정도가 아닙니다.'));detail.append(box);}else detail.append(node('p','비교할 이전 결과가 공유되지 않았거나 비교 조건이 달라요.'));
    }
    if(record.kind==='CHECKUP'){
      const previous=data.records.filter(r=>r.kind==='CHECKUP'&&r.date<record.date&&r.method===record.method).sort((a,b)=>b.date.localeCompare(a.date))[0];
      const table=node('table'),body=node('tbody');table.append(node('caption',previous?`${previous.date} → ${record.date} · 공유된 건강검진 결과`:'공유된 건강검진 결과'),body);
      const titles=node('tr');for(const title of previous?['항목','이전','이번','차이']:['항목','결과'])titles.append(node('th',title));body.append(titles);
      for(const f of record.fields??[]){
        const tr=node('tr');tr.append(node('th',f.label));
        const old=previous?.fields?.find(p=>p.label===f.label&&p.unit===f.unit);
        if(previous)tr.append(node('td',old?`${old.value} ${old.unit||''}`:'비교 결과 없음'));
        tr.append(node('td',`${f.value} ${f.unit||''}`));
        if(previous){const delta=Number.isFinite(old?.value)&&Number.isFinite(f.value)?f.value-old.value:null;tr.append(node('td',delta===null?'수치 비교 없음':`${delta>0?'+':''}${Math.round(delta*10)/10} ${f.unit||''}`));}
        body.append(tr);
      }
      const scroll=node('div',undefined,'chr-table-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','건강검진 비교표 · 좌우로 이동 가능');scroll.append(table);
      detail.append(node('p','표를 옆으로 이동하면 이전·이번 값을 함께 볼 수 있어요.','chr-table-hint'),scroll,node('p',previous?'동일 합성 검사 방식의 수치 차이입니다. 진단·정상 판정이 아닙니다.':'이전 결과를 함께 공유받으면 수치 차이를 비교할 수 있어요.'));
    }
    if(record.kind==='ULTRASOUND'){
      const image=node('img');image.src='/images/mediq-synthetic-liver-ultrasound-v1.png';image.alt='합성 간 초음파 시연 이미지';detail.append(image,node('p','합성 이미지 예시이며 실제 초음파 판독 결과를 제공하지 않습니다.'));
    }
  }
  return {selectReception(id){invalidate();receptionConsent=id;data=null;shares=[];},setActive(value){active=value;if(value)void load();else{invalidate();data=null;shares=[];status('의료진 로그인이 필요해요.');}},reset(){receptionConsent=null;active=false;invalidate();data=null;shares=[];selected='';query='';filter='ALL';status('의료진 로그인이 필요해요.');}};
}
