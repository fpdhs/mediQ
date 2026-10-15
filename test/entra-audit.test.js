import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeEntraRows,listEntraAudit} from '../src/entra-audit.js';
import {parseEventQuery,buildEventIndex,createSecurityReport} from '../src/security-console.js';
const now=new Date('2026-10-14T09:00:00Z');
const env={HIPASS_AZURE_AUDIT_MI_ENABLED:'1',HIPASS_AUDIT_WORKSPACE_ID:'11111111-1111-1111-1111-111111111111',HIPASS_AUDIT_SOCKET:'/run/security-audit/audit.sock'};
test('Entra records include only project apps and safe numeric results, no UPN/IP',()=>{
 const row={Id:'secret',TimeGenerated:now.toISOString(),AppId:'3f8bd8d2-4a43-4ec4-849b-788c5f49ba74',ResultType:'0',UserPrincipalName:'secret@example.com',IPAddress:'secret'};
 const events=sanitizeEntraRows([row,{...row,AppId:'foreign'},{...row,ResultType:'secret'}]);assert.equal(events.length,1);assert.equal(events[0].result,'SUCCESS');assert.ok(!JSON.stringify(events).includes('secret'));
 const index=buildEventIndex([],{status:'unavailable'},[],parseEventQuery(new URLSearchParams('source=ENTRA'),now),undefined,{status:'available',events});assert.equal(index.total,1);assert.equal(index.chart.total,0);
 assert.equal(createSecurityReport(index,{events:[{source:'ENTRA',eventRef:events[0].eventRef}],format:'PRINT'},'ADMIN').events.length,1);
});
test('Entra relay failure is not zero successful sign-ins and arbitrary socket is rejected',async()=>{
 assert.equal((await listEntraAudit({env,socketRequest:async()=>{throw new Error('secret');}})).status,'unavailable');
 assert.equal((await listEntraAudit({env:{...env,HIPASS_AUDIT_SOCKET:'/tmp/foo'}})).status,'misconfigured');
 assert.equal((await listEntraAudit({env,socketRequest:async()=>({status:'available',events:[]})})).status,'available');
});
