const jobId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const hospital=id=>({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id]||'공유 기관');
export function transferPresentation(job){
  const total=Number(job.totalItems),verified=Number(job.succeededItems),failed=Number(job.failedItems);
  if(!Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(verified)||!Number.isSafeInteger(failed)||verified<0||failed<0||verified+failed>total)return {label:'결과 확인 필요',tone:'warning',total:0,verified:0,failed:0,remaining:0};
  const complete=job.state==='COMPLETED'&&verified===total&&failed===0;
  const states={CREATED:'전송 대기',IN_PROGRESS:'전송·검증 중',PARTIAL:'일부 완료 · 이어서 확인',FAILED:'실패 · 확인 필요',EXPIRED:'동의 기간 만료',REVOKED:'동의 철회'};
  return {label:complete?'B PACS 보관 확인':states[job.state]||'결과 확인 필요',tone:complete?'success':['FAILED','EXPIRED','REVOKED'].includes(job.state)?'fail':'warning',total,verified,failed,remaining:total-verified-failed};
}
function el(tag,text,cls){const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;}
export function initializeTransferActions({readHistory,readJob,stageSelected,active,context}){
  const host=document.querySelector('#hospital-saas-app'),transfer=document.querySelector('[data-screen="transfer"]');
  if(!host||!transfer)return null;
  const css=el('link');css.rel='stylesheet';css.href='/ui/transfer-actions.css';document.head.append(css);
  const actions=[];
  for(const selector of ['.studio-top-actions','.desk-action-row']){
    const target=host.querySelector(selector);if(!target)continue;
    const button=el('button','B병원에 보관','mq-btn transfer-primary-action');button.type='button';button.disabled=true;
    button.onclick=()=>{if(active()&&ready())stageSelected();};target.append(button);actions.push(button);
  }
  const pc=document.querySelector('#download-instance');if(pc){pc.hidden=true;pc.disabled=true;pc.title='PC 다운로드 차단 · B병원 PACS 보관만 제공';}
  const board=el('section',null,'transfer-history-board');board.setAttribute('aria-label','병원 보관 작업 이력');
  const heading=el('header',null,'transfer-history-heading'),title=el('div');title.append(el('h3','영상 수신 현황'),el('p','최근 50건 · 내가 요청한 병원 보관 작업'));
  const refresh=el('button','이력 새로고침','mq-btn');refresh.type='button';heading.append(title,refresh);
  const status=el('p','이력을 확인해 주세요.','transfer-history-status');status.setAttribute('role','status');
  const list=el('div',null,'transfer-history-list'),receipt=el('div',null,'transfer-history-receipt');receipt.setAttribute('aria-live','polite');
  board.append(heading,status,list,receipt,el('p','PC 다운로드는 차단되어 있습니다. 보관 완료는 B PACS 저장본을 서버가 재검증한 경우에만 표시합니다.','transfer-history-note'));
  transfer.append(board);
  let generation=0,timer=null;
  function ready(){const c=context().consent;return active()&&context().selected&&!context().busy&&c?.status==='ACTIVE'&&c.permission==='DOWNLOAD_ALLOWED'&&Date.parse(c.validFrom)<=Date.now()&&Date.now()<Date.parse(c.validUntil);}
  function update(){if(!active()){clear();return;}for(const button of actions){button.disabled=!ready();button.title=ready()?'선택 영상 1건을 보관함에 담고 최종 확인합니다.':'유효한 다운로드 동의와 선택 영상이 필요합니다.';}}
  function clear(){generation++;clearTimeout(timer);timer=null;list.replaceChildren();receipt.replaceChildren();status.textContent='의료진 로그인 후 확인하세요.';for(const b of actions)b.disabled=true;}
  async function details(id){
    if(!jobId(id)||!active())return;const request=++generation;receipt.replaceChildren();status.textContent='저장된 검증 결과를 확인하고 있어요.';
    try{const result=await readJob(id);if(request!==generation||!active())return;if(result.error||result.jobId!==id)throw Error('RECEIPT_UNAVAILABLE');
      const view=transferPresentation(result),title=el('h4',view.label);receipt.append(title,el('p',`${view.verified} / ${view.total}건 검증 완료 · 실패 ${view.failed}건`));
      for(const item of result.items||[]){const verified=item.state==='SUCCEEDED'&&/^[a-f0-9]{64}$/.test(item.sourceSha256||'')&&item.sourceSha256===item.destinationSha256;
        receipt.append(el('p',`영상 ${item.ordinal} · ${verified?'✓ 저장본 해시 일치':item.state==='SUCCEEDED'?'검증 근거 확인 필요':item.reasonCode||'검증 완료 전'}`));}
      status.textContent='서버에 기록된 전송 결과입니다.';
    }catch{if(request===generation&&active())status.textContent='영수증을 확인하지 못했습니다. 다시 시도하세요.';}
  }
  async function load(){
    if(!active())return;const request=++generation;status.textContent='서버의 작업 이력을 확인하고 있어요.';refresh.disabled=true;
    try{const data=await readHistory();if(request!==generation||!active())return;if(!Array.isArray(data.jobs))throw Error('HISTORY_UNAVAILABLE');
      list.replaceChildren();receipt.replaceChildren();
      for(const job of data.jobs){if(!jobId(job.jobId))continue;const view=transferPresentation(job),row=el('article',null,`transfer-history-row transfer-history-${view.tone}`);
        const path=el('div',`${hospital(job.sourceHospitalId)} → ${hospital(job.targetHospitalId)}`,'transfer-history-route');
        const count=el('strong',`${view.verified} / ${view.total}`,'transfer-history-count'),label=el('span',view.label,'transfer-history-label');
        const note=el('p',`검증 완료 ${view.verified}건 · 실패 ${view.failed}건 · 미완료 ${view.remaining}건`);
        const time=Date.parse(job.updatedAt),when=el('small',Number.isFinite(time)?new Date(time).toLocaleString('ko-KR'):'처리 시각 확인 필요');
        const button=el('button','검증 영수증','mq-btn');button.type='button';button.onclick=()=>details(job.jobId);row.append(path,label,count,note,when,button);list.append(row);
      }
      status.textContent=data.jobs.length?`${data.jobs.length}개 작업 · 완료·실패 이력이 새로고침 후에도 유지됩니다.`:'아직 기록된 병원 보관 작업이 없습니다.';
    }catch{if(request===generation&&active()){list.replaceChildren();receipt.replaceChildren();status.textContent='작업 이력을 불러오지 못했습니다. 다시 시도하세요.';}}
    finally{if(request===generation)refresh.disabled=false;}
  }
  function watch(){clearTimeout(timer);let attempts=0;const poll=async()=>{if(!active())return;update();if(!transfer.hidden)await load();if(++attempts<40&&context().busy)timer=setTimeout(poll,3000);};timer=setTimeout(poll,500);}
  refresh.onclick=load;
  if(pc)new MutationObserver(update).observe(pc,{attributes:true,attributeFilter:['disabled']});
  new MutationObserver(()=>{if(!transfer.hidden){void load();watch();}}).observe(transfer,{attributes:true,attributeFilter:['hidden']});
  update();return {load,clear,update,watch};
}
