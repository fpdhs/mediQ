const actions={IMAGE_VIEWED:'영상 조회 기록',IMAGE_TRANSFER:'영상 전송 기록',TOKEN_ISSUED:'단기 토큰 발급',ACCESS_CHECK:'접근 조건 확인',TICKET_REDEEMED:'연결 정보 사용',CONSENT_CREATED:'동의 생성',CONSENT_REVOKED:'동의 철회',LOGIN_SUCCESS:'로그인 성공',LOGIN_FAILED:'로그인 실패'};
export function auditEvent(log,index=0) {
  const result=String(log.result||'UNKNOWN');
  const kind=['ALLOWED','SUCCESS'].includes(result)?'allowed':result==='DENIED'?'denied':['ERROR','FAILED','FAILURE'].includes(result)?'error':'unknown';
  const timestamp=log.createdAt||log.timestamp;
  const time=Date.parse(timestamp);
  return {key:String(log.auditId||log.id||`row-${index}`),session:typeof log.auditSessionId==='string'&&log.auditSessionId?log.auditSessionId:'unlinked',time,
    date:Number.isFinite(time)?new Date(time).toLocaleString('ko-KR'):'시각 미확인',
    title:actions[log.action]||'시스템 행위 기록',action:String(log.action||'미확인'),kind,
    label:({allowed:'허용·성공',denied:'거부',error:'처리 실패',unknown:'확인 필요'})[kind],
    reason:String(log.reasonCode||'사유 코드 미제공'),result,
    hospital:String(log.hospitalId||log.targetHospitalId||'미확인'),actor:String(log.actorType||'미확인'),
    description:kind==='denied'?'서버가 이 요청을 거부한 기록입니다. 정상적인 보안 차단일 수 있습니다.':kind==='error'?'처리 실패가 기록됐습니다. 정책상 거부와 구분해 확인해야 합니다.':kind==='allowed'?'이 행위의 허용 또는 성공 기록입니다. 영상 픽셀 표시·저장·감사 전체 완료를 뜻하지 않습니다.':'결과를 자동 판정하지 않았습니다. 기술 근거를 확인해 주세요.'};
}
export function auditModels(logs) {return logs.filter(x=>x&&typeof x==='object').map(auditEvent).sort((a,b)=>(Number.isFinite(a.time)?a.time:Infinity)-(Number.isFinite(b.time)?b.time:Infinity));}
export function renderSecurityTimeline(root,logs=null,state='ready') {
  if(!root)return;
  const list=root.querySelector('[data-audit-events]'),detail=root.querySelector('[data-audit-detail]'),status=root.querySelector('[data-audit-status]'),select=root.querySelector('[data-audit-session]');
  if(!root.dataset.bound){root.dataset.bound='true';select.addEventListener('change',()=>{root._selected=null;draw();});root.addEventListener('click',e=>{const b=e.target.closest('[data-audit-key]');if(b){root._selected=b.dataset.auditKey;draw();}const step=e.target.closest('[data-audit-move]');if(step){const rows=visible();const i=rows.findIndex(x=>x.key===root._selected);root._selected=rows[Math.max(0,Math.min(rows.length-1,i+Number(step.dataset.auditMove)))]?.key;draw();}});}
  root._models=state==='ready'&&Array.isArray(logs)?auditModels(logs):[];
  list.replaceChildren();detail.replaceChildren();
  if(state!=='ready'){select.replaceChildren();status.textContent=state==='loading'?'기록을 조회하고 있습니다.':'기록을 조회하지 못했습니다. 인증·열람 권한과 연결을 확인하고 다시 조회해 주세요.';return;}
  const previous=select.value;select.replaceChildren();
  const sessions=[...new Set(root._models.map(x=>x.session))];
  sessions.forEach((session,i)=>{const option=document.createElement('option');option.value=session;option.textContent=session==='unlinked'?'실행 연결 미확인':`실행 ${i+1} · ${session.slice(0,12)}…`;select.append(option);});
  if(sessions.includes(previous))select.value=previous;
  root._readAt=new Date().toLocaleString('ko-KR');draw();
  function visible(){return (root._models||[]).filter(x=>x.session===select.value);}
  function draw(){
    const rows=visible();list.replaceChildren();detail.replaceChildren();
    status.textContent=`조회 ${root._readAt} (${Intl.DateTimeFormat().resolvedOptions().timeZone}) · 수신 ${root._models.length}건 / 선택 ${rows.length}건 · API 조회 범위 내 기록(전체 이력 아님)`;
    if(!rows.length){detail.textContent='조회 범위에 표시할 기록이 없습니다.';return;}
    if(!rows.some(x=>x.key===root._selected))root._selected=rows[0].key;
    rows.forEach(row=>{const li=document.createElement('li'),b=document.createElement('button'),time=document.createElement('small'),title=document.createElement('strong'),badge=document.createElement('span');b.type='button';b.dataset.auditKey=row.key;b.dataset.kind=row.kind;b.setAttribute('aria-pressed',String(row.key===root._selected));time.textContent=row.date;title.textContent=row.title;badge.textContent=row.label;b.append(time,title,badge);li.append(b);list.append(li);});
    const row=rows.find(x=>x.key===root._selected);
    const heading=document.createElement('h3');heading.textContent=row.title;const p=document.createElement('p');p.textContent=row.description;detail.append(heading,p);
    const dl=document.createElement('dl');for(const [label,value]of [['결과',row.label],['요청 기관',row.hospital],['주체 유형',row.actor],['기록 시각',row.date]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}detail.append(dl);
    const technical=document.createElement('details'),summary=document.createElement('summary');summary.textContent='기술 근거 펼치기';technical.append(summary);for(const [label,value] of [['행위',row.action],['서버 결과',row.result],['사유 코드',row.reason],['실행 연결',row.session==='unlinked'?'미확인':row.session]]){const line=document.createElement('p');line.textContent=`${label}: ${value}`;technical.append(line);}detail.append(technical);
    const nav=document.createElement('div');nav.className='audit-step-nav';[-1,1].forEach(direction=>{const b=document.createElement('button');b.type='button';b.dataset.auditMove=String(direction);b.textContent=direction===-1?'이전 기록':'다음 기록';b.disabled=direction===-1?row===rows[0]:row===rows.at(-1);nav.append(b);});detail.append(nav);
  }
}
