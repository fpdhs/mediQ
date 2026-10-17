export const STANDARD_HEALTH_PATH='/api/v1/me/health-records/standard';

export function validateStandardSnapshot(value) {
  if (value?.synthetic!==true || value.clinicalUse!==false || value.fhirVersion!=='4.0.1'
    || !Array.isArray(value.records) || !Array.isArray(value.studies) || !value.counts
    || value.fhirBundle?.resourceType!=='Bundle' || !Array.isArray(value.fhirBundle.entry)
    || typeof value.patient?.displayName!=='string' || !Number.isFinite(Date.parse(value.refreshedAt))) throw new Error('HEALTH_RECORDS_UNAVAILABLE');
  return value;
}

export function createScenarioHealthStandard({root,request,onSnapshot,onView,available}) {
  let pending=null,revision=0;
  const state=root.querySelector('#phr-load-state');
  const button=root.querySelector('#phr-refresh');
  const imaging=root.querySelector('#phr-imaging-list');
  const records=root.querySelector('#phr-record-list');
  const raw=root.querySelector('#phr-fhir-json');
  const text=(selector,value)=>{root.querySelector(selector).textContent=String(value);};
  const element=(tag,content,className)=>{const node=document.createElement(tag);node.textContent=content;if(className)node.className=className;return node;};
  const clear=()=>{for(const selector of ['#phr-patient-name','#phr-encounter-count','#phr-observation-count','#phr-imaging-count'])text(selector,'—');records.replaceChildren();imaging.replaceChildren();raw.textContent='';};
  function render(snapshot) {
    clear();
    text('#phr-patient-name',snapshot.patient.displayName);
    text('#phr-encounter-count',snapshot.counts.records);
    text('#phr-observation-count',snapshot.counts.observations);
    text('#phr-imaging-count',snapshot.counts.imagingStudies);
    for(const record of snapshot.records) {
      const details=document.createElement('details');details.className='scenario-record';
      details.append(element('summary',`${record.title} · ${record.date}`),element('p',record.hospital,'subtle'));
      const fields=record.kind==='CHECKUP'?record.fields:record.kind==='AFP'?[{label:record.title,value:record.value,unit:record.unit}]:[];
      const dl=document.createElement('dl');
      for(const field of fields)dl.append(element('dt',field.label),element('dd',`${field.value} ${field.unit||''}`.trim()));
      details.append(dl);
      if(record.kind==='ULTRASOUND') {
        details.append(element('p','합성 초음파 예시 · 실제 촬영·판독 자료가 아닙니다.'));
        if(record.image==='/images/mediq-synthetic-liver-ultrasound-v1.png') {
          const image=document.createElement('img');image.src=record.image;image.alt='합성 간 초음파 예시 이미지 · 비임상';image.loading='lazy';details.append(image);
        }
      }
      records.append(details);
    }
    if(!snapshot.records.length)records.append(element('p','등록된 건강기록이 없습니다.'));
    for(const study of snapshot.studies) {
      const card=element('article','','scenario-record');
      const count=study.series.reduce((n,s)=>n+s.instanceCount,0);
      card.append(element('h3',study.modality==='CT'?'복부 CT':study.modality),element('p',`${study.studyDate} · ${study.series.length}개 시리즈 · ${count}장`),
        element('p','등록된 영상검사 정보입니다. 원본 열람은 별도의 권한·연결 확인이 필요합니다.','subtle'));
      const view=element('button','영상 열람 확인','btn small');view.type='button';
      view.addEventListener('click',()=>onView(study));card.append(view);imaging.append(card);
    }
    if(!snapshot.studies.length)imaging.append(element('p','연결된 영상검사가 없습니다. 다른 샘플 영상으로 대체하지 않습니다.'));
    raw.textContent=JSON.stringify(snapshot.fhirBundle,null,2);
  }
  return {
    reset(){revision++;pending=null;clear();button.disabled=false;root.removeAttribute('aria-busy');state.textContent='내 기록을 다시 불러와 주세요.';state.dataset.state='empty';},
    load(){
      if(!available())return Promise.resolve();
      if(pending)return pending;
      const generation=++revision;button.disabled=true;root.setAttribute('aria-busy','true');clear();
      state.textContent='로그인한 계정의 건강기록과 등록 영상을 확인하고 있어요.';state.dataset.state='loading';
      pending=(async()=>{
        try {
          const snapshot=validateStandardSnapshot(await request(STANDARD_HEALTH_PATH));
          if(generation!==revision||!available())return;
          await onSnapshot(snapshot);
          if(generation!==revision||!available())return;
          render(snapshot);state.textContent=`내 기록 ${snapshot.counts.records}건 · 영상검사 ${snapshot.counts.imagingStudies}건 · 마지막 확인 ${new Date(snapshot.refreshedAt).toLocaleString('ko-KR')}`;state.dataset.state='success';
        } catch(error) {
          if(generation!==revision||!available())return;
          clear();state.textContent=/AUTH|TOKEN|JWT|ENTRA/.test(error.message)?'로그인 상태를 확인하고 다시 로그인해 주세요.':'기록을 불러오지 못했습니다. 계정·시연 기록 연결 상태를 확인한 뒤 다시 시도해 주세요.';state.dataset.state='fail';
        } finally {if(generation===revision){pending=null;button.disabled=false;root.removeAttribute('aria-busy');}}
      })();
      return pending;
    },
  };
}
