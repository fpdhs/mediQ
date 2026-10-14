import { showSecurityReport } from './security-report.js';
const mounted = new WeakMap();
const bad = new Set(['DENIED','FAIL','FAILED','ERROR','FAILURE']);
const names = { TOKEN_EXPIRED:'토큰 유효기간 만료', CONSENT_EXPIRED:'동의 기간 만료', CONSENT_REVOKED:'동의 철회', SCOPE_MISMATCH:'검사 범위 불일치', HOSPITAL_MISMATCH:'수신 병원 불일치', ROLE_NOT_ALLOWED:'허용되지 않은 역할', TOKEN_INVALID:'유효하지 않은 토큰', DOWNLOAD_NOT_ALLOWED:'다운로드 미허용', SECURITY_CONSOLE_DENIED:'관제실 접근 거부', SECURITY_OVERVIEW_READ:'관제 기록 조회', SECURITY_EVENTS_SEARCHED:'이벤트 검색', SECURITY_REPORT_GENERATED:'사건 보고서 생성', TOKEN_ISSUED:'접근 토큰 발급', IMAGE_VIEWED:'의료영상 열람', CONSENT_CREATED:'공유 동의 생성', CONSENT_REVOKED:'공유 동의 철회' };
const reviewNames = {UNREVIEWED:'검토 전',REVIEWED:'검토 완료',INVESTIGATING:'조사 중',ACTION_REQUIRED:'조치 필요',FALSE_POSITIVE:'오탐 판단'};
const colors = {'허용·성공':'#52c6b2','거부·실패':'#ff947e','기타·경보':'#aab9ed'};
function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,fn,cls='sc-button'){const node=el('button',text,cls);node.type='button';node.addEventListener('click',fn);return node;}
function time(value){return Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR'):'시각 미확인';}
function title(value){return names[value]||value||'미확인';}
function saveFile(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const link=el('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function reportCsv(report){
  const quote=value=>{let text=String(value??'');if(/^[\s]*[=+\-@]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const rows=[['보고서 ID',report.reportId],['상태',report.status],['생성 시각',report.generatedAt],['범위 시작',report.scope.from],['범위 종료',report.scope.until],['SHA-256',report.fingerprint],['주의',...report.limitations],[],['시각','출처','행위','결과','사유','기관','이벤트 참조','검토 상태','검토 메모']];
  for(const event of report.events)rows.push([event.time,event.source,event.action,event.result,event.reasonCode,event.hospitalId,event.eventRef,event.review?.status||'UNREVIEWED',event.review?.note||'']);
  return '\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
}
function printReport(report){
  showSecurityReport(report,{actionLabel:title,reasonLabel:title});
}
export function renderSecurityConsole(root,api){
  let state=mounted.get(root);
  if(!state){state={api,selected:new Map(),version:0,until:null};mounted.set(root,state);build(root,state);}
  state.api=api;root.closest('[data-screen="audit"]')?.classList.add('security-console-active');
  if(api.state==='loading'){state.status.textContent='감사 자료를 연결하고 있어요.';return;}
  if(api.state!=='ready'){state.status.textContent='관제 자료를 불러오지 못했습니다. 로그인과 연결 상태를 확인해 주세요.';state.heroCount.textContent='—';state.charts.replaceChildren(el('p','집계 미확인 · 조회 실패를 0건으로 표시하지 않습니다.'));return;}
  state.overview=api.overview;state.until=null;load(state);
}
function build(root,state){
  root.replaceChildren();root.classList.add('sc-root');
  const hero=el('header',null,'sc-hero'),heading=el('div');heading.append(el('p','Medi Q 보안 관제실','sc-brand'),el('h2','신호를 읽고, 사건을 연결하세요.'),el('p','동의부터 영상 열람까지, 남겨진 기록을 따라갑니다.','sc-subtitle'));
  const signal=button('',()=>{state.review.value='UNREVIEWED';state.result.value='거부·실패';load(state);state.explorer.scrollIntoView({behavior:'auto'});},'sc-signal');state.heroCount=el('strong','—');signal.append(state.heroCount,el('span','확인할 접근 거부·실패'));hero.append(heading,signal);root.append(hero);
  const nav=el('nav',null,'sc-nav');nav.setAttribute('aria-label','관제실 바로가기');nav.append(button('상황판',()=>state.charts.scrollIntoView({behavior:'auto'})),button('이벤트 탐색',()=>state.explorer.scrollIntoView({behavior:'auto'})),button('보고서 바구니',()=>state.basket.scrollIntoView({behavior:'auto'})),button('새 기록 불러오기',()=>state.api.refresh()));state.status=el('p','감사 자료 연결 중…','sc-status');state.status.setAttribute('role','status');root.append(nav,state.status);
  state.sources=el('div',null,'sc-sources');state.charts=el('div',null,'sc-charts');root.append(state.sources,state.charts);
  const work=el('div',null,'sc-work');state.explorer=el('section',null,'sc-explorer');state.explorer.append(el('h3','이벤트 탐색기'));
  const form=el('form',null,'sc-search');const searchLabel=el('label','이벤트 검색');state.search=el('input');state.search.type='search';state.search.maxLength=120;state.search.placeholder='TOKEN_EXPIRED, 토큰, 병원 또는 이벤트 참조';searchLabel.append(state.search);form.append(searchLabel);
  const select=(label,options)=>{const field=el('label',label),node=el('select');for(const[value,text]of options)node.add(new Option(text,value));field.append(node);form.append(field);return node;};
  state.source=select('출처',[['','모든 출처'],['APP','앱·Gateway'],['AZURE_KEYVAULT','Azure Key Vault'],['WAF','웹 방화벽 · WAF'],['ENTRA','Microsoft Entra']]);
  state.result=select('결과',[['','모든 결과'],['허용·성공','허용·성공'],['거부·실패','거부·실패'],['기타·경보','기타·경보']]);
  state.review=select('검토 상태',[['','모든 상태'],...Object.entries(reviewNames)]);
  state.hospital=select('기관·자원',[['','모든 기관·자원']]);
  state.period=select('조회 기간',[['24','최근 24시간'],['6','최근 6시간'],['1','최근 1시간']]);
  const submit=el('button','검색','sc-button sc-primary');submit.type='submit';form.append(submit,button('필터 초기화',()=>{for(const node of [state.search,state.source,state.result,state.review,state.hospital])node.value='';state.category='';state.action='';load(state);}));
  form.addEventListener('submit',event=>{event.preventDefault();state.category='';state.action='';load(state);});state.explorer.append(form);
  state.count=el('p','—','sc-count');state.list=el('div',null,'sc-events');state.pager=el('div',null,'sc-pager');state.explorer.append(state.count,state.list,state.pager);
  const side=el('aside',null,'sc-side');state.detail=el('section',null,'sc-detail');state.detail.append(el('h3','사건을 따라가 볼까요?'),el('p','이벤트를 선택하면 관련 흐름과 검토 기록을 확인할 수 있어요.'));state.basket=el('section',null,'sc-basket');side.append(state.detail,state.basket);work.append(state.explorer,side);root.append(work);drawBasket(state);
  const boundary=el('details',null,'sc-boundary');boundary.append(el('summary','조회 범위와 기록 연결 확인'));state.boundary=el('p','확인 전');boundary.append(state.boundary);root.append(boundary);
}
async function load(state,page=0){
  const version=++state.version;state.loading=true;drawBasket(state);state.status.textContent='이벤트와 집계를 불러오는 중…';
  const query=new URLSearchParams({page:String(page),hours:state.period.value});if(state.until)query.set('until',state.until);
  for(const[key,value]of Object.entries({q:state.search.value,source:state.source.value,result:state.result.value,review:state.review.value,hospital:state.hospital.value,category:state.category,action:state.action}))if(value)query.set(key,value);
  try{const data=await state.api.fetchJson('/api/security/events?'+query,{signal:AbortSignal.timeout(15000),cache:'no-store'});if(version!==state.version)return;state.data=data;state.until=data.until;state.loading=false;state.status.textContent=`조회 기준 ${time(data.until)} · 이전 ${data.query.hours}시간`;drawSources(state);drawCharts(state);drawEvents(state);drawBasket(state);}
  catch{if(version!==state.version)return;state.loading=false;drawBasket(state);state.status.textContent='이벤트 조회 실패 · 기존 선택 기록은 유지됩니다.';state.charts.replaceChildren(el('p','집계를 확인할 수 없습니다. 다시 불러오기를 눌러 주세요.'));state.list.replaceChildren(el('p','이벤트를 조회하지 못했습니다.'));}
}
function drawSources(state){
  const {sources}=state.data;state.sources.replaceChildren();
  const azureStatus={available:'연결됨',not_configured:'연결 미설정',permission_required:'조회 권한 확인 필요',misconfigured:'연결 설정 확인 필요',unavailable:'연결 확인 필요'};
  const items=[['앱 감사 기록','연결됨',`${sources.app.total}건 · 저장된 최근 ${state.data.query.hours}시간 기록`],['Azure Key Vault',azureStatus[sources.azure.status]||'상태 확인 필요',`${sources.azure.status==='available'?sources.azure.count+'건 · 최근 최대 100건':'이 출처의 로그는 아직 확인할 수 없습니다.'}`],['영상·Gateway',sources.gateway.count?'수집된 이벤트 있음':'선택 기간 이벤트 없음',`${sources.gateway.count}건 · 앱 감사 경로에 수집된 기록`],['웹 방화벽 · WAF',sources.waf.status==='available'?'실제 로그 연결됨':sources.waf.status==='stale'?'수집 지연':'수집 상태 확인 필요',sources.waf.status==='available'?`${sources.waf.count}개 규칙 이벤트 · ${sources.waf.denied}개 명시적 차단 기록 · 제한된 표본`:'확인되지 않은 로그를 0건으로 집계하지 않습니다.'],['Microsoft Entra',azureStatus[sources.entra.status]||'조회 확인 필요',sources.entra.status==='available'?`${sources.entra.count}개 로그인 기록 · 프로젝트 앱 한정 · 최근 최대 100개`:'원본 이벤트를 확인할 수 없습니다.']];
  for(const[label,status,copy]of items){const node=el('article');node.append(el('span',label),el('strong',status),el('small',copy));state.sources.append(node);}
  const integrity=state.overview?.applicationAudit?.integrity;state.boundary.textContent=`앱: 저장된 감사 기록의 이전 ${state.data.query.hours}시간 전체 집계. Azure: 최근 24시간 최신 최대 100건${sources.azure.truncatedPossible?' · 추가 기록이 있을 수 있음':''}. WAF: ${sources.waf.scope||'수집 미확인'} · 탐지는 차단과 다르며 하나의 요청에 여러 규칙이 기록될 수 있습니다. Entra: ${sources.entra.scope} · ${sources.entra.diagnostics} · ${sources.entra.license}. 앱 해시 연결: ${integrity?.ok?'확인됨 ('+integrity.checked+'건)': '검증 실패 또는 미확인 ('+(integrity?.reason||'근거 없음')+')'}. 해시 연결 결과는 외부 보관·로그 수집 완전성을 보증하지 않습니다.`;
}
function drawCharts(state){
  const chart=state.data.chart;state.heroCount.textContent=chart.unreviewed.toLocaleString();state.charts.replaceChildren();
  const panel=(heading,copy)=>{const node=el('section',null,'sc-chart');node.append(el('h3',heading),el('p',copy));state.charts.append(node);return node;};
  const outcomes=panel('접근 결과의 균형',`앱 기록 ${chart.total.toLocaleString()}건 · 선택 시점 이전 ${chart.periodHours}시간 전체`);
  const ring=el('div',null,'sc-ring-row'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('role','img');svg.setAttribute('aria-label',chart.results.map(item=>`${item.label} ${item.count}건`).join(',')||'집계된 앱 기록 없음');
  const circle=(stroke,offset,dash)=>{const c=document.createElementNS(svg.namespaceURI,'circle');for(const[k,v]of Object.entries({cx:60,cy:60,r:45,fill:'none',stroke,'stroke-width':13,'stroke-dasharray':dash,'stroke-dashoffset':offset,transform:'rotate(-90 60 60)'}))c.setAttribute(k,String(v));svg.append(c);};
  circle('#dce6ed',0,'283 0');let offset=0;for(const item of chart.results){const length=chart.total?item.count/chart.total*282.743:0;circle(colors[item.label],-offset,`${length} ${282.743-length}`);offset+=length;}
  const text=document.createElementNS(svg.namespaceURI,'text');text.setAttribute('x','60');text.setAttribute('y','65');text.setAttribute('text-anchor','middle');text.textContent=String(chart.total);svg.append(text);ring.append(svg);
  const legend=el('div',null,'sc-legend');for(const item of chart.results)legend.append(button(`${item.label} ${item.count}건`,()=>{state.result.value=item.label;load(state);},'sc-legend-button'));if(!chart.total)legend.append(el('p','선택 기간에 저장된 기록이 없습니다.'));ring.append(legend);outcomes.append(ring);
  const reasons=panel('거부된 이유를 읽어요',`거부·실패 ${chart.denied}건 · 사유별 상위 6개`);const max=Math.max(1,...chart.reasons.map(item=>item.count));for(const item of chart.reasons){const row=button('',()=>{state.search.value=item.label;state.result.value='거부·실패';load(state);},'sc-bar-button');row.append(el('span',title(item.label)),el('strong',`${item.count}건`));const bar=el('i');bar.style.width=(item.count/max*100)+'%';row.append(bar);reasons.append(row);}if(!chart.reasons.length)reasons.append(el('p','조회 범위에 거부·실패 기록이 없습니다.'));
  const trend=panel('시간에 따라 달라지는 신호','앱 이벤트 · 시간별 전체 건수와 거부·실패 건수');const columns=el('div',null,'sc-columns');const peak=Math.max(1,...chart.hours.map(item=>item.count));for(const item of chart.hours){const col=el('div',null,'sc-column');col.title=`${time(item.time)}: 전체 ${item.count}건 / 거부·실패 ${item.denied}건`;col.setAttribute('role','img');col.setAttribute('aria-label',col.title);const all=el('i'),denied=el('b');all.style.height=(item.count/peak*100)+'%';denied.style.height=(item.denied/peak*100)+'%';col.append(all,denied);columns.append(col);}trend.append(columns,el('small',`${time(chart.hours[0].time)} ~ ${time(state.data.until)} · 파랑 전체 / 주황 거부·실패`));
  const kinds=panel('어떤 활동이 있었나요?','종류를 누르면 이벤트 목록이 좁혀집니다.');const chips=el('div',null,'sc-kind-chips');for(const item of chart.categories)chips.append(button(`${item.label} ${item.count}건`,()=>{state.category=item.label;load(state);},'sc-chip'));kinds.append(chips);
  const waf=state.data.sources.waf,firewall=panel('웹 입구에서 발견한 신호','WAF 규칙 이벤트 표본 · 전체 접속 대비 차단률이 아닙니다.');
  if(waf.status==='available'){
    firewall.append(el('p',`탐지 ${waf.count-waf.denied}개 · 명시적 차단 ${waf.denied}개 · 수집 ${time(waf.observedAt)}`));
    const peak=Math.max(1,...waf.rules.map(item=>item.count));
    for(const item of waf.rules){const row=button('',()=>{state.source.value='WAF';state.search.value=item.label;state.category='';state.result.value='';load(state);},'sc-bar-button');row.append(el('span',item.label),el('strong',`${item.count}개`));const bar=el('i');bar.style.width=(item.count/peak*100)+'%';row.append(bar);firewall.append(row);}
    if(!waf.count)firewall.append(el('p','수집된 표본에 선택 기간 규칙 이벤트가 없습니다.'));
  }else firewall.append(el('p','수집 지연 또는 연결 실패 · 탐지 건수 미확인'));
  const entra=state.data.sources.entra,identity=panel('로그인의 바깥쪽 근거','Microsoft Entra 원본 · 지정 앱 로그인 표본');
  if(entra.status==='available'){
    const peak=Math.max(1,...entra.results.map(item=>item.count));for(const item of entra.results){const row=button('',()=>{state.source.value='ENTRA';state.result.value=item.label;state.category='';state.search.value='';load(state);},'sc-bar-button');row.append(el('span',item.label),el('strong',`${item.count}건`));const bar=el('i');bar.style.width=(item.count/peak*100)+'%';row.append(bar);identity.append(row);}
    if(!entra.count)identity.append(el('p','조회는 성공했지만 선택 기간의 지정 앱 로그인 기록은 없습니다. 수집 지연·진단 설정은 별도 확인이 필요합니다.'));
  }else identity.append(el('p','Entra 조회 실패 또는 미설정 · 건수 미확인'));
  identity.append(el('small',entra.diagnostics));
}
function drawEvents(state){
  const data=state.data;state.count.textContent=`검색 결과 ${data.total}건 · ${data.page+1}페이지${state.category?' · '+state.category:''}`;state.list.replaceChildren();
  const hospital=state.hospital.value;state.hospital.replaceChildren(new Option('모든 기관·자원',''));for(const value of data.facets.hospitals)state.hospital.add(new Option(value,value));state.hospital.value=hospital;
  for(const event of data.events){const row=el('article',null,'sc-event');row.dataset.result=event.resultGroup;const open=button('',()=>showDetail(state,event),'sc-event-open');open.append(el('small',`${time(event.time)} · ${event.source==='APP'?'앱':event.source==='WAF'?'웹 방화벽':event.source==='ENTRA'?'Entra':'Key Vault'}`),el('strong',event.source==='WAF'?'웹 방화벽 규칙 탐지':event.source==='ENTRA'?'Microsoft 로그인':title(event.action)),el('span',`${event.source==='WAF'?(event.result==='DENIED'?'명시적 차단 기록':'탐지 · 차단 여부 미확인'):event.resultGroup} · ${title(event.reasonCode)}`),el('small',`${event.hospitalId} · ${reviewNames[event.review?.status||'UNREVIEWED']}`));row.append(open,button(state.selected.has(event.source+':'+event.eventRef)?'담김':'＋ 보고서',()=>{toggleSelected(state,event);drawEvents(state);},'sc-add'));state.list.append(row);}
  if(!data.events.length)state.list.append(el('p','검색 조건에 맞는 이벤트가 없습니다. 필터를 초기화해 보세요.','sc-empty'));
  state.pager.replaceChildren();const prev=button('이전',()=>load(state,data.page-1)),next=button('다음',()=>load(state,data.page+1));prev.disabled=data.page===0;next.disabled=(data.page+1)*data.pageSize>=data.total;state.pager.append(prev,next);
}
function toggleSelected(state,event){const key=event.source+':'+event.eventRef;if(state.selected.has(key))state.selected.delete(key);else if(state.selected.size<50)state.selected.set(key,event);else state.status.textContent='보고서 한 건에는 최대 50개 이벤트를 담을 수 있습니다.';drawBasket(state);}
async function showDetail(state,event){
  const version=(state.detailVersion||0)+1;state.detailVersion=version;const host=state.detail;host.replaceChildren(el('h3',title(event.action)),el('p',`${time(event.time)} · ${event.resultGroup}`));const list=el('dl');for(const[label,value]of [['출처',event.source],['기관·자원',event.hospitalId],['주체 유형',event.actorType],['사유',title(event.reasonCode)],['이벤트 참조',event.eventRef],['검토',reviewNames[event.review?.status||'UNREVIEWED']]]){list.append(el('dt',label),el('dd',value));}host.append(list);if(event.review?.note)host.append(el('p','검토 메모: '+event.review.note));host.append(button('보고서에 담기 / 빼기',()=>{toggleSelected(state,event);drawEvents(state);}));
  if(event.auditSessionId&&event.auditSessionId!=='UNKNOWN'){
    const flow=el('ol',null,'sc-flow');host.append(el('h4','같은 실행의 연결 기록'),flow);
    try{const query=new URLSearchParams({session:event.auditSessionId,until:state.until,hours:state.period.value});const data=await state.api.fetchJson('/api/security/events?'+query,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(version!==state.detailVersion)return;for(const related of [...data.events].reverse())flow.append(el('li',`${time(related.time)} · ${title(related.action)} · ${related.result}`));flow.append(el('li',`관련 ${data.total}건 중 최신 ${data.events.length}건 · 같은 감사 세션 기준`));}catch{if(version===state.detailVersion)flow.append(el('li','관련 흐름을 불러오지 못했습니다.'));}
  }else host.append(el('p','공통 감사 세션이 없어 다른 이벤트와 자동 연결하지 않았습니다.'));
  if(['AZURE_KEYVAULT','WAF','ENTRA'].includes(event.source)||bad.has(event.result)){
    const form=el('form',null,'sc-review');form.append(el('h4','검토 기록 남기기'));const statusLabel=el('label','검토 상태'),select=el('select');for(const[value,label]of Object.entries(reviewNames).filter(([value])=>value!=='UNREVIEWED'))select.add(new Option(label,value));statusLabel.append(select);const noteLabel=el('label','운영 메모'),note=el('input');note.maxLength=160;note.placeholder='환자 식별정보 없이 조치 내용 기록';noteLabel.append(note);const submit=el('button','검토 이력 추가','sc-button sc-primary');submit.type='submit';const feedback=el('p');feedback.setAttribute('role','status');form.append(statusLabel,noteLabel,submit,feedback);host.append(form);form.addEventListener('submit',async action=>{action.preventDefault();submit.disabled=true;try{await state.api.postJson('/api/security/reviews',{source:event.source,eventRef:event.eventRef,status:select.value,note:note.value});feedback.textContent='검토 이력을 추가했습니다.';state.api.refresh();}catch{feedback.textContent='검토를 저장하지 못했습니다. 메모의 식별정보와 이벤트 유효성을 확인해 주세요.';submit.disabled=false;}});
  }
}
function drawBasket(state){
  const host=state.basket;host.replaceChildren(el('h3',`보고서 바구니 · ${state.selected.size}`),el('p','관련 이벤트를 모아 사건의 흐름을 남겨요.'));for(const[key,event]of state.selected){const row=el('div',null,'sc-basket-item');row.append(el('span',title(event.action)),button('빼기',()=>{state.selected.delete(key);drawBasket(state);if(state.data)drawEvents(state);},'sc-text-button'));host.append(row);}if(!state.selected.size)host.append(el('p','이벤트 옆의 ＋ 보고서를 눌러 담아 주세요.'));
  const actions=el('div',null,'sc-report-actions');for(const[format,label]of [['PRINT','PDF / 인쇄'],['CSV','CSV 저장'],['JSON','근거 JSON']]){const action=button(label,()=>exportReport(state,format));action.disabled=!state.selected.size||state.exporting||state.loading;actions.append(action);}host.append(actions);state.reportStatus=el('p',state.reportMessage||'생성 문서는 검토 전 초안으로 표시됩니다.','sc-report-status');state.reportStatus.setAttribute('role','status');host.append(state.reportStatus);
}
async function exportReport(state,format){
  if(state.exporting||state.loading||!state.until||!state.selected.size)return;
  state.exporting=true;state.reportMessage='선택한 근거로 보고서를 만들고 있어요.';drawBasket(state);
  try{const query=new URLSearchParams({until:state.until,hours:state.period.value});const report=await state.api.postJson('/api/security/reports?'+query,{events:[...state.selected.values()].map(event=>({source:event.source,eventRef:event.eventRef})),format});
    if(format==='PRINT')printReport(report);else if(format==='CSV')saveFile(report.reportId+'.csv',reportCsv(report),'text/csv;charset=utf-8');else saveFile(report.reportId+'.json',JSON.stringify(report,null,2),'application/json');state.reportMessage=`초안 생성 완료 · ${report.events.length}건 · ${report.reportId}`;
  }catch{state.reportMessage='보고서를 생성하지 못했습니다. 로그인·출처 연결 상태를 확인하고 만료된 이벤트는 다시 선택해 주세요.';}
  finally{state.exporting=false;drawBasket(state);}
}
