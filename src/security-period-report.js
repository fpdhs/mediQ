import {createHash,randomUUID} from 'node:crypto';

// Short-lived metadata snapshots only. Never persist tokens, QR codes or raw logs.
const snapshots=new Map(),TTL=15*60*1000,MAX=32;
const groups=['허용·성공','거부·실패','기타·경보'];
export function rememberSecurityReport(report,now=Date.now()){
  for(const [id,item] of snapshots)if(item.expires<=now)snapshots.delete(id);
  while(snapshots.size>=MAX)snapshots.delete(snapshots.keys().next().value);
  snapshots.set(report.reportId,{actor:report.generatedBy,expires:now+TTL,json:JSON.stringify(report)});
  return report;
}
export function readSecurityReportSnapshot(body,actor,now=Date.now()){
  if(!body||Object.keys(body).some(k=>!['snapshotId','format'].includes(k))||!['PRINT','CSV','JSON'].includes(body.format)||typeof body.snapshotId!=='string'||!/^SEC-[a-f0-9-]{36}$/u.test(body.snapshotId))throw new Error('SECURITY_REPORT_INVALID');
  const saved=snapshots.get(body.snapshotId);
  if(!saved||saved.actor!==actor||saved.expires<=now)throw new Error('SECURITY_REPORT_SNAPSHOT_UNAVAILABLE');
  return JSON.parse(saved.json);
}
export function periodSummary(events,from,until){
  const countBy=field=>Object.entries(events.reduce((a,e)=>{const k=e[field]||'미확인';a[k]=(a[k]||0)+1;return a;},Object.create(null))).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);
  const denied=events.filter(e=>e.resultGroup==='거부·실패');
  const reasons=Object.entries(denied.reduce((a,e)=>{const k=e.reasonCode||'미확인';a[k]=(a[k]||0)+1;return a;},Object.create(null))).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,10);
  const start=Date.parse(from),end=Date.parse(until),step=end-start>48*3600000?86400000:3600000;
  const hours=Array.from({length:Math.max(1,Math.ceil((end-start)/step))},(_,i)=>({label:new Date(start+i*step).toISOString(),count:0}));
  for(const e of events){const i=Math.min(hours.length-1,Math.floor((Date.parse(e.time)-start)/step));if(i>=0)hours[i].count++;}
  const reviewed=events.filter(e=>e.review?.status&&e.review.status!=='UNREVIEWED').length;
  return {total:events.length,denied:denied.length,reviewed,unreviewed:events.length-reviewed,
    outcomes:groups.map(label=>({label,count:events.filter(e=>e.resultGroup===label).length})),reasons,sources:countBy('source'),hours,bucketHours:step/3600000};
}
export function createPeriodSecurityReport(index,body,actor){
  if(!body||body.mode!=='PERIOD'||Object.keys(body).some(k=>!['mode','format','events'].includes(k))||!['PRINT','CSV','JSON'].includes(body.format)||!Array.isArray(body.events)||body.events.length>50)throw new Error('SECURITY_REPORT_INVALID');
  const matched=index.filteredEvents,refs=new Set();
  const details=body.events.map(ref=>{
    if(!ref||Object.keys(ref).some(k=>!['source','eventRef'].includes(k))||typeof ref.eventRef!=='string'||ref.eventRef.length>128)throw new Error('SECURITY_REPORT_INVALID');
    const key=ref.source+':'+ref.eventRef;if(refs.has(key))throw new Error('SECURITY_REPORT_INVALID');refs.add(key);
    const event=matched.find(e=>e.source===ref.source&&e.eventRef===ref.eventRef);if(!event)throw new Error('SECURITY_REPORT_EVENT_UNAVAILABLE');return event;
  });
  const events=(details.length?details:matched.slice(0,50)).sort((a,b)=>a.time.localeCompare(b.time));
  const report={reportId:'SEC-'+randomUUID(),status:'DRAFT',mode:'PERIOD',title:'기간별 보안 검토 보고서',generatedAt:new Date().toISOString(),generatedBy:actor,requestedFormat:body.format,
    scope:{from:index.from,until:index.until,timeZone:'Asia/Seoul',filters:Object.fromEntries(['q','source','result','category','action','hospital','review','session'].map(k=>[k,index.query[k]])),sources:structuredClone(index.sources),matchedCount:matched.length,selectedCount:events.length,detailSelection:details.length?'MANUAL':'LATEST_50'},
    summary:periodSummary(matched,index.from,index.until),events:structuredClone(events),
    limitations:['집계는 선택한 기간·필터에 일치하는 수집된 기록 전체이며, 상세 근거는 최대 50건입니다. 수집되지 않은 기록까지 포함한 전체 활동 통계가 아닙니다.',
      '앱은 현재 저장된 감사 기록 범위입니다. Key Vault·Entra는 최근 24시간 최신 최대 100건 표본이며, WAF는 제한된 규칙 탐지 표본입니다. 장기 조회도 해당 출처의 수집 범위를 확대하지 않습니다.',
      '조회 실패·미연결·부분 수집은 0건 또는 무사고의 근거가 아닙니다. 거부·실패는 공격 확정이 아니며 시연 시험일 수 있습니다.',
      '생성 시점의 집계와 상세를 고정합니다. 신규 로그·지연 수집은 새 보고서로 다시 생성해야 합니다. 같은 보고서의 서버 재출력은 생성 후 15분 및 서버 재시작 전까지 지원합니다.',
      'SHA-256은 보고서 데이터 비교용이며 전자서명 또는 원본성 인증이 아닙니다.']};
  return rememberSecurityReport({...report,fingerprint:createHash('sha256').update(JSON.stringify(report)).digest('hex')});
}
