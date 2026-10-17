// UI capability hints never replace server authorization.
import {walletConsentState} from './wallet-home.js';
import {icon} from './patient.js';
const MENU={
  'patient-home':['navigation','home'],'doctor-home':['navigation','dashboard'],
  records:['flow','image'],sharing:['flow','share'],history:['flow','clock'],
  'clinical-records':['flow','image'],qr:['flow','qr'],pacs:['flow','archive'],
  journey:['explanation','shield'],audit:['admin','audit'],admin:['admin','dashboard'],
  simulate:['execution','qr']
};
const GROUPS=[['flow','시연 진행'],['explanation','보안 설명'],['admin','관리자 도구'],['navigation','화면 이동'],['execution','실행 작업']];
export function demoMenuGroups(items) {
  const groups=GROUPS.map(([id,label])=>({id,label,items:items.filter(item=>MENU[item.id]?.[0]===id&&!item.environmentRestricted)})).filter(group=>group.items.length);
  const restricted=items.filter(item=>item.environmentRestricted);
  if(restricted.length)groups.push({id:'restricted',label:'내부 시연 전용',items:restricted});
  return groups;
}
export function demoEnvironment(host) {
  if(['localhost','127.0.0.1','[::1]'].includes(host))return 'LOCAL';
  return host==='192.168.111.149'?'PRIVATE':'PUBLIC';
}
export function demoToolsModel({persona,roles=[],environment,study,consent,ready=false}) {
  const patient=persona==='PATIENT',internal=['LOCAL','PRIVATE'].includes(environment),items=[];
  const matching=Boolean(ready&&study?.patientId&&consent&&consent.patientId===study.patientId&&consent.scopes?.some(s=>s.allowed!==false&&s.studyInstanceUid===study.studyInstanceUid));
  const current=matching&&consent.status==='ACTIVE'&&Date.parse(consent.validFrom)<=Date.now()&&Date.now()<Date.parse(consent.validUntil);
  const add=(id,label,enabled=true,reason='')=>items.push({id,label,enabled,reason,icon:MENU[id][1],environmentRestricted:!internal&&['pacs','journey','admin'].includes(id)});
  if(patient) add('patient-home','환자 홈',roles.includes('PATIENT'),'환자 계정 인증 필요');
  if(!patient&&roles.includes('DOCTOR')) add('doctor-home','의료진 홈',true);
  if(patient&&roles.includes('PATIENT')) {
    add('records','내 건강기록');add('sharing','공유 관리');add('history','내 공유 이력');
  } else if(!patient&&roles.includes('DOCTOR')) {
    add('clinical-records','환자 기록');
    add('qr','QR 접수');
    for(const [id,label] of [['pacs','전송 확인'],['journey','영상 보안 여정']])add(id,label,internal,'이 공개 환경에서 미지원');
    add('simulate','시연 QR 불러오기',environment==='PUBLIC','공개 합성 시연 환경에서 환자가 발급한 코드를 입력합니다');
  }
  if(!patient&&roles.some(r=>['SECURITY_ADMIN','PLATFORM_ADMIN'].includes(r))) add('audit','보안 관제실',true);
  if(!patient&&roles.some(r=>['HOSPITAL_ADMIN','PLATFORM_ADMIN'].includes(r))) add('admin','운영 관제',internal,'이 공개 환경에서 미지원');
  return {items,study:ready?study:null,consent:matching?consent:null,ready};
}
export async function runDemoAction(id,{read,confirm,execute}) {
  let state=read();
  const enabled=()=>demoToolsModel(state).items.find(i=>i.id===id)?.enabled;
  if(!enabled())return false;
  if(id==='simulate') {
    const identity=s=>JSON.stringify([s.persona,s.study?.studyInstanceUid,s.seriesUid,s.consent]);
    const key=identity(state);
    if(!await confirm('환자가 발급한 연결 코드를 직접 붙여넣습니다. QR 촬영만 대신하며, 접수 시 서버 권한 검증을 수행합니다. 계속할까요?'))return false;
    state=read();if(!enabled()||identity(state)!==key)return false;
  }
  await execute(id);return true;
}
export function initializeDemoTools({read,execute,refresh,confirm=message=>window.confirm(message)}) {
  const dialog=document.querySelector('#clinician-tools'),triggers=[...document.querySelectorAll('[data-demo-tools-open]')];
  if(!dialog||!triggers.length)return null;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  document.body.append(dialog);dialog.replaceChildren();dialog.classList.add('shared-demo-tools','demo-menu-redesign');
  const heading=node('header','demo-tools-heading'),title=node('h2','','시연도구'),close=node('button','demo-tools-close','×');
  title.id='clinician-tools-title';close.type='button';close.setAttribute('aria-label','시연도구 닫기');heading.append(title,close);
  const environment=node('p','demo-tools-intro'),context=node('section','demo-tools-current');context.setAttribute('aria-label','현재 선택한 검사와 공유');
  const selected=node('strong','','선택한 검사 없음'),detail=node('p','demo-tools-patient'),route=node('p','demo-tools-route');
  const consentText=node('span','demo-tools-consent'),permission=node('span','demo-tools-permission');
  const stateLine=node('div','demo-tools-state');stateLine.append(icon('shield'),consentText,permission);
  const identifiers=node('details','demo-tools-identifiers'),summary=node('summary','','선택 범위 자세히'),scope=node('p','');identifiers.append(summary,scope);
  context.append(node('span','demo-tools-context-label','현재 선택'),selected,detail,route,stateLine,node('p','demo-tools-boundary','접근 허용·영상 수신은 별도 확인이 필요합니다.'),identifiers);
  const menu=node('nav','demo-tools-list');menu.setAttribute('aria-label','역할별 시연 기능');
  const mobile=node('a','demo-tools-mobile');mobile.append(icon('phone'),node('span','','환자 모바일 앱'),node('small','','새 창'));mobile.href='/mobile/';mobile.target='_blank';mobile.rel='noopener';
  const status=node('p','demo-tools-read-status');status.setAttribute('role','status');
  const reload=node('button','demo-tools-refresh','↻');reload.type='button';reload.title='상태 새로고침';reload.setAttribute('aria-label','상태 새로고침');
  const footer=node('footer','demo-tools-footer');footer.append(status,reload);
  dialog.append(heading,environment,context,menu,mobile,footer);
  let opener=null,busy=false,menuKey='',updatedAt=null;
  function update() {
    const state=read(),model=demoToolsModel(state);
    const accountArea=state.roles.includes('SECURITY_ADMIN')?'보안 관리자':state.persona==='PATIENT'?'환자 화면':'의료진 화면';
    environment.textContent=`합성 시연 · ${{PUBLIC:'공개 웹',PRIVATE:'병원 내부 시연',LOCAL:'로컬 시연'}[state.environment]} · ${accountArea}`;
    selected.textContent=model.study?.description||(model.ready?'선택한 검사 없음':'선택 정보 확인 필요');
    detail.textContent=model.study?`환자 ${model.study.patientId}`:'최신 기록을 확인하고 검사를 선택해 주세요.';
    const hospital=id=>({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id]||id||'미확인');
    route.textContent=model.study?`${hospital(model.study.sourceHospitalId)} → ${model.consent?hospital(model.consent.targetHospitalId):'수신 병원 미확인'}`:'';
    route.hidden=!model.study;
    consentText.textContent=model.consent?walletConsentState(model.consent):'공유 동의 미확인';
    stateLine.dataset.state=model.consent&&walletConsentState(model.consent)==='공유 동의 유효'?'valid':'unconfirmed';
    permission.textContent=model.consent?({VIEW_ONLY:'열람만',DOWNLOAD_ALLOWED:'다운로드 허용'}[model.consent.permission]||'권한 확인 필요'):'';
    identifiers.hidden=!model.study;
    scope.textContent=model.study?`Study: ${model.study.studyInstanceUid}\nSeries: ${state.seriesUid||'미선택'}\n동의: ${model.consent?.consentId||'없음'}\n목적: ${model.consent?.purpose||'미확인'}\n기간: ${model.consent?.validFrom||'미확인'} ~ ${model.consent?.validUntil||'미확인'}`:'';
    const key=JSON.stringify(model.items);
    if(key!==menuKey) {
      menuKey=key;menu.replaceChildren();
      for(const group of demoMenuGroups(model.items)) {
        const section=node(group.id==='restricted'?'details':'section','demo-menu-group');section.dataset.group=group.id;
        const label=node(group.id==='restricted'?'summary':'h3','',group.label);label.id=`demo-group-${group.id}`;section.setAttribute('aria-labelledby',label.id);section.append(label);
        if(group.id==='restricted')label.append(node('span','demo-tools-count',String(group.items.length)));
        const list=node('div','demo-menu-rows');section.append(list);menu.append(section);
        for(const item of group.items) {
        const row=node('div','demo-tools-option'),button=node('button','demo-menu-button'),copy=node('span','demo-menu-copy');
        button.type='button';button.dataset.demoAction=item.id;button.disabled=!item.enabled;
        copy.append(node('span','demo-menu-label',item.label));button.append(icon(item.icon),copy);row.append(button);
        const marker=node('span','demo-menu-marker',item.id==='simulate'?'실행 전 확인':item.enabled?'›':'—');marker.setAttribute('aria-hidden','true');button.append(marker);
        if(!item.enabled){const reason=node('small','',item.reason);reason.id=`demo-reason-${item.id}`;button.setAttribute('aria-describedby',reason.id);copy.append(reason);}
        button.addEventListener('click',async()=>{
          if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');
          try{const done=await runDemoAction(item.id,{read,confirm,execute:async id=>{await execute(id);dialog.close();}});if(!done)status.textContent='실행하지 않았습니다. 선택 상태와 권한을 확인해 주세요.';}
          catch{status.textContent='요청을 완료하지 못했습니다. 상태를 새로고침해 주세요.';}
          finally{busy=false;dialog.removeAttribute('aria-busy');}
        });list.append(row);
        }
      }
    }
    const page=state.persona==='PATIENT'?document.querySelector('#patient-portal-app .page:not([hidden])')?.dataset.page:document.querySelector('#hospital-saas-app .mq-screen:not([hidden])')?.dataset.screen;
    const active=state.persona==='PATIENT'?{home:'patient-home',phr:'records',sharing:'sharing',activity:'history'}[page]:{dashboard:'doctor-home',records:'clinical-records',qr:'qr','pacs-archive':'pacs',exchange:'journey',audit:'audit',admin:'admin'}[page];
    for(const button of menu.querySelectorAll('[data-demo-action]')) {
      const current=button.dataset.demoAction===active&&!button.disabled;
      if(current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
      if(button.dataset.demoAction!=='simulate')button.querySelector('.demo-menu-marker').textContent=current?'현재':button.disabled?'—':'›';
    }
    if(!model.ready)status.textContent='최신 상태 미확인 · 접근 허용을 의미하지 않습니다.';
    else if(!busy)status.textContent=updatedAt?`새로고침 완료 · ${updatedAt}`:'서버 조회 상태 · 동의와 영상 수신 결과는 별개입니다.';
  }
  for(const trigger of triggers)trigger.addEventListener('click',()=>{opener=trigger;update();if(!dialog.open)dialog.showModal();trigger.setAttribute('aria-expanded','true');close.focus();});
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],summary')].filter(el=>el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  dialog.addEventListener('close',()=>{triggers.forEach(t=>t.setAttribute('aria-expanded','false'));if(opener?.checkVisibility())opener.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  reload.addEventListener('click',async()=>{if(busy)return;busy=true;reload.disabled=true;status.textContent='상태 확인 중…';try{await refresh();updatedAt=new Date().toLocaleTimeString('ko-KR');busy=false;update();}catch{status.textContent='새로고침 실패 · 이전 상태를 최신으로 사용하지 마세요.';}finally{busy=false;reload.disabled=false;}});
  const app=document.querySelector('#hospital-saas-app'),names={'pacs-archive':'전송 확인',exchange:'영상 보안 여정',audit:'보안 관제실',admin:'운영 관제'};
  const sync=()=>{const screen=app?.querySelector('.mq-screen:not([hidden])')?.dataset.screen,back=document.querySelector('#demo-tool-return'),name=document.querySelector('#demo-tool-name');if(back)back.hidden=!names[screen];if(name)name.textContent=names[screen]||'';};
  app?.querySelectorAll('.mq-screen').forEach(s=>new MutationObserver(sync).observe(s,{attributes:true,attributeFilter:['hidden']}));sync();
  return {update,close:()=>dialog.close()};
}
