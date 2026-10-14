import {renderSecurityConsole} from '/ui/security-console.js';
if(!['127.0.0.1','localhost'].includes(location.hostname))throw new Error('LOCAL_PREVIEW_ONLY');
const root=document.querySelector('.security-observatory');
const headers={'x-hipass-role':'SECURITY_ADMIN','x-hipass-user-id':'synthetic-security-auditor'};
async function fetchJson(path,options={}){const response=await fetch(path,{...options,headers:{...headers,...options.headers}});if(!response.ok)throw new Error('REQUEST_FAILED');return response.json();}
const postJson=(path,body)=>fetchJson(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function refresh(){renderSecurityConsole(root,{state:'loading'});const overview=await fetchJson('/api/security/overview');renderSecurityConsole(root,{state:'ready',overview,fetchJson,postJson,refresh});}
await refresh();
