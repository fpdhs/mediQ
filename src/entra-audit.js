import { createHash } from 'node:crypto';
import { request } from 'node:http';
const APPS=new Set(['3f8bd8d2-4a43-4ec4-849b-788c5f49ba74','e6893ab6-fb6a-4a1c-8390-df1698dae05e']);
const QUERY=`SigninLogs | where TimeGenerated >= ago(24h)
| where AppId in ('3f8bd8d2-4a43-4ec4-849b-788c5f49ba74','e6893ab6-fb6a-4a1c-8390-df1698dae05e')
| project TimeGenerated, AppId, ResultType, Id | order by TimeGenerated desc | take 100`;
export function sanitizeEntraRows(rows) {
  return rows.slice(0,100).filter(row=>APPS.has(row.AppId) && Number.isFinite(Date.parse(row.TimeGenerated)) && /^\d{1,8}$/u.test(String(row.ResultType)))
    .map(row=>({eventRef:createHash('sha256').update(String(row.Id)+'|'+row.TimeGenerated+'|'+row.AppId).digest('hex').slice(0,24),
      time:new Date(row.TimeGenerated).toISOString(),application:row.AppId=== [...APPS][0]?'HIGH_PASS_WEB':'HIGH_PASS_API',
      result:String(row.ResultType)==='0'?'SUCCESS':'DENIED',reasonCode:'ENTRA_'+row.ResultType}));
}
function readSocket() {
  return new Promise((resolve,reject)=>{
    const req=request({socketPath:'/run/security-audit/audit.sock',path:'/entra-audit',method:'GET',timeout:12000},res=>{
      let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>131072)req.destroy(new Error('TOO_LARGE'));else chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>{try{if(res.statusCode!==200)throw new Error('RELAY_FAILED');resolve(JSON.parse(Buffer.concat(chunks)));}catch(error){reject(error);}});
    });req.on('timeout',()=>req.destroy(new Error('TIMEOUT')));req.on('error',reject);req.end();
  });
}
export async function listEntraAudit({env=process.env,fetchImpl=globalThis.fetch,socketRequest=readSocket}={}) {
  const empty=(status,reason)=>({status,reason,observedAt:new Date().toISOString(),events:[],scope:'프로젝트 앱 2개 · 최근 24시간 최신 최대 100개 로그인 기록'});
  if(env.HIPASS_AZURE_AUDIT_MI_ENABLED!=='1'||!env.HIPASS_AUDIT_WORKSPACE_ID)return empty('not_configured','WORKSPACE_NOT_CONFIGURED');
  if(!/^[a-f0-9-]{36}$/iu.test(env.HIPASS_AUDIT_WORKSPACE_ID))return empty('misconfigured','WORKSPACE_ID_INVALID');
  try {
    if(env.HIPASS_AUDIT_SOCKET){
      if(env.HIPASS_AUDIT_SOCKET!=='/run/security-audit/audit.sock')return empty('misconfigured','AUDIT_SOCKET_INVALID');
      const value=await socketRequest();if(!['available','permission_required','unavailable','not_configured','misconfigured'].includes(value?.status)||!Array.isArray(value.events))throw new Error('INVALID_RELAY');
      return {...empty(value.status,/^[A-Z_]{1,80}$/u.test(value.reason||'')?value.reason:null),observedAt:Number.isFinite(Date.parse(value.observedAt))?new Date(value.observedAt).toISOString():new Date().toISOString(),
        events:value.status==='available'?value.events.slice(0,100).filter(row=>/^[a-f0-9]{24}$/u.test(row.eventRef||'')&&['HIGH_PASS_WEB','HIGH_PASS_API'].includes(row.application)&&['SUCCESS','DENIED'].includes(row.result)&&/^ENTRA_\d{1,8}$/u.test(row.reasonCode||'')&&Number.isFinite(Date.parse(row.time)))
          .map(row=>({eventRef:row.eventRef,time:new Date(row.time).toISOString(),application:row.application,result:row.result,reasonCode:row.reasonCode})):[]};
    }
    const url=new URL('http://169.254.169.254/metadata/identity/oauth2/token');url.searchParams.set('api-version','2018-02-01');url.searchParams.set('resource','https://api.loganalytics.io');
    const mr=await fetchImpl(url,{headers:{Metadata:'true'},redirect:'error',signal:AbortSignal.timeout(2500)});if(!mr.ok)throw new Error('MI_UNAVAILABLE');const token=(await mr.json()).access_token;
    const response=await fetchImpl('https://api.loganalytics.azure.com/v1/workspaces/'+env.HIPASS_AUDIT_WORKSPACE_ID+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:QUERY,timespan:'PT24H'}),redirect:'error',signal:AbortSignal.timeout(7000)});
    if(!response.ok)return empty(response.status===403?'permission_required':'unavailable',response.status===403?'LOG_ANALYTICS_READER_REQUIRED':'ENTRA_QUERY_FAILED');
    const data=await response.json();const rows=[];
    for(const table of data.tables||[]){const names=(table.columns||[]).map(column=>column.name);for(const values of table.rows||[])rows.push(Object.fromEntries(names.map((key,i)=>[key,values[i]])));}
    return {...empty('available',null),events:sanitizeEntraRows(rows)};
  } catch {return empty('unavailable','ENTRA_SOURCE_UNAVAILABLE');}
}
