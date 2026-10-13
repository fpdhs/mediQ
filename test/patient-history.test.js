import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyRows,createPatientHistory} from '../public/ui/patient-history.js';
const study={studyInstanceUid:'2.25.1',sourceHospitalId:'HOSP-A',description:'합성 복부 CT 시연 영상',studyDate:'2026-10-10',series:[{instanceCount:700}]};
const consent={consentId:'first',status:'ACTIVE',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',validFrom:'2020-01-01',validUntil:'2099-01-01',scopes:[{studyInstanceUid:'2.25.1',allowed:true}]};
test('history derives expiry and pending honestly; filters hospital, exam, ended state and exact scopes',()=>{
 const rows=[consent,{...consent,consentId:'expired',validUntil:'2020-01-02'},{...consent,consentId:'future',validFrom:'2090-01-01'},{...consent,consentId:'revoked',status:'REVOKED'}];
 assert.equal(historyRows(rows,[study],'ACTIVE').length,1);assert.equal(historyRows(rows,[study],'ENDED').length,2);assert.equal(historyRows(rows,[study],'ALL','B대학병원').length,4);assert.equal(historyRows(rows,[study],'ALL','MRI').length,0);assert.equal(historyRows(rows,[study],'ALL','복부').length,4);assert.equal(historyRows([{...consent,scopes:[{studyInstanceUid:'other',allowed:true}]}],[study])[0].selected.length,0);
});
function fixture(){
 const make=tag=>({tag,children:[],textContent:'',dataset:{},attributes:{},value:'',hidden:false,append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(k,v){this.attributes[k]=v;},querySelector(){return null;},focus(){}});
 const fields=Object.fromEntries(['history-list','history-detail','history-search','history-feedback','patient-receipts-refresh'].map(key=>[key,make('div')]));const filters=['ALL','ACTIVE','ENDED'].map(value=>{const n=make('button');n.dataset.historyFilter=value;return n;});
 const root={querySelector:s=>fields[s.slice(1)],querySelectorAll:()=>filters},document={createElement:make,createElementNS:(_,tag)=>make(tag)};
 const text=n=>n.textContent+n.children.map(text).join(' ');return{fields,filters,root,document,text};
}
test('renders scoped consent details without inventing hospital/view events or exposing IDs, tokens or staff; survives refresh',()=>{
 const f=fixture(),old=globalThis.document;globalThis.document=f.document;
 try{const ui=createPatientHistory({root:f.root,onManage(){},onRefresh(){}});ui.update([study],[consent]);const text=f.text(f.fields['history-detail']);assert.match(text,/접수 기록 연동 전/);assert.match(text,/열람 기록 연동 전/);assert.match(text,/승인 시각은 현재 조회 정보에서 확인할 수 없어요/);assert.doesNotMatch(text,/first|2\.25\.1|전달 완료|의사가 확인/);assert.match(f.text(f.fields['history-list']),/700장/);f.fields['history-search'].value='MRI';f.fields['history-search'].oninput();assert.match(f.text(f.fields['history-list']),/조건에 맞는/);assert.equal(f.fields['history-detail'].hidden,true);ui.update([study],[{...consent,permission:'DOWNLOAD_ALLOWED'}]);assert.equal(f.fields['history-search'].value,'MRI');}finally{globalThis.document=old;}
});
test('refresh failure preserves rows, explains stale data; empty history invites preparation without mutation',async()=>{
 const f=fixture(),old=globalThis.document;globalThis.document=f.document;let managed=0;
 try{const ui=createPatientHistory({root:f.root,onManage(){managed++;},onRefresh:async()=>{throw Error('offline');}});ui.update([study],[consent]);await f.fields['patient-receipts-refresh'].onclick();assert.match(f.fields['history-feedback'].textContent,/마지막 조회/);assert.match(f.text(f.fields['history-list']),/복부 CT/);assert.equal(f.fields['patient-receipts-refresh'].disabled,false);ui.update([],[]);assert.match(f.text(f.fields['history-list']),/아직 공유 기록/);assert.equal(managed,0);}finally{globalThis.document=old;}
});
test('history remains presentation-only; no network/audit queries or unsafe html/storage',()=>{const source=readFileSync('public/ui/patient-history.js','utf8');assert.doesNotMatch(source,/fetch\(|postJson|innerHTML|localStorage|sessionStorage|accessToken|auditSessionId/);});
