import { constants, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';

export function sanitizeWafSnapshot(snapshot, now = Date.now()) {
  if (!snapshot || !Array.isArray(snapshot.events) || !['available','unavailable'].includes(snapshot.status)) throw new Error('WAF_SNAPSHOT_INVALID');
  const observed = Date.parse(snapshot.observedAt);
  if (!Number.isFinite(observed) || observed > now + 1000 || now - observed > 180000) return { status:'stale',reason:'WAF_COLLECTOR_STALE',events:[] };
  const events = snapshot.status === 'available' ? snapshot.events.slice(0,500).filter(event => /^[a-f0-9]{24}$/u.test(event.eventRef ?? '')
    && /^\d{4,8}$/u.test(event.ruleId ?? '') && ['DETECTED','DENIED'].includes(event.result)
    && Number.isFinite(Date.parse(event.time)) && Date.parse(event.time) <= now && Date.parse(event.time) >= now - 86400000)
    .map(event => ({ eventRef:event.eventRef, time:new Date(event.time).toISOString(), ruleId:event.ruleId, result:event.result })) : [];
  return {status:snapshot.status, observedAt:new Date(observed).toISOString(), windowHours:24, truncatedPossible:true,
    scope:'최근 24시간 로그 중 최대 3,000줄·2MiB에서 추출한 최신 최대 500개 규칙 이벤트',events};
}

export async function listWafAudit({env=process.env, now=Date.now()}={}) {
  if (env.HIPASS_AUDIT_SOCKET !== '/run/security-audit/audit.sock') return {status:'not_configured',events:[]};
  let descriptor;
  try {
    descriptor=openSync('/run/security-audit/waf-events.json',constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(descriptor);
    if (!stat.isFile() || stat.size > 262144) throw new Error('WAF_SNAPSHOT_INVALID');
    return sanitizeWafSnapshot(JSON.parse(readFileSync(descriptor,'utf8')),now);
  } catch { return {status:'unavailable',reason:'WAF_SNAPSHOT_UNAVAILABLE',events:[]}; }
  finally { if(descriptor!==undefined)closeSync(descriptor); }
}
