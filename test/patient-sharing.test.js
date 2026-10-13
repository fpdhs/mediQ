import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recipientChoices,sharingConsentModel,sharingDraftModel,createPatientSharing} from '../public/ui/patient-sharing.js';
const study={studyInstanceUid:'2.25.1',sourceHospitalId:'HOSP-A',description:'합성 복부 CT 시연 영상',modality:'CT',studyDate:'2026-10-10',series:[{instanceCount:700}]};
const consent={consentId:'one',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TREATMENT',permission:'VIEW_ONLY',status:'ACTIVE',validFrom:'2020-01-01',validUntil:'2099-01-01',scopes:[{studyInstanceUid:'2.25.1',allowed:true}]};
test('sharing paper reuses original wallet shell and mobile static cache without changing approval contracts',()=>{
 const js=readFileSync('public/ui/patient-sharing.js','utf8'),css=readFileSync('public/ui/wallet-record-sheet.css','utf8'),mobile=readFileSync('public/mobile/app.js','utf8'),sw=readFileSync('public/mobile/sw.js','utf8');
 assert.match(js,/selected:'sharing'/);assert.match(js,/paper.append\(\.\.\.root.children\)/);assert.match(js,/어떤 영상을 어디로 공유할까요/);
 assert.match(css,/sharing-extracted-sheet/);assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(mobile,/createSharingSurface\(document.querySelector\('#tab-share'\)/);assert.match(sw,/shell-v39/);assert.match(sw,/\/ui\/patient-sharing.js/);
 assert.doesNotMatch(js,/innerHTML|localStorage|sessionStorage/);
});
test('unfolded sharing summary and mobile referral preserve explicit review and server purpose',()=>{const html=readFileSync('public/index.html','utf8'),mobile=readFileSync('public/mobile/index.html','utf8'),js=readFileSync('public/mobile/app.js','utf8'),css=readFileSync('public/ui/wallet-home.css','utf8');assert.match(html,/sharing-open-wallet/);assert.match(html,/sharing-summary-values/);assert.match(mobile,/value="TRANSFER" selected>전원/);assert.match(js,/purpose: state.sharePurpose/);assert.match(js,/INVALID_SHARE_PURPOSE/);assert.match(css,/health-wallet-sheet:before/);assert.doesNotMatch(html+mobile,/의견 상담/);});
test('draft accepts clinical purposes and explicit operations; rejects invalid, expired, reversed or unbounded periods',()=>{
 const input={study,target:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',from:'2026-10-11T10:00',until:'2026-10-12T10:00'},now=Date.parse('2026-10-11T09:00');
 for(const purpose of ['TREATMENT','TRANSFER','CONSULTATION'])for(const permission of ['VIEW_ONLY','DOWNLOAD_ALLOWED'])assert.equal(sharingDraftModel({...input,purpose,permission},now).valid,true);
 for(const changes of [{purpose:'RESEARCH'},{purpose:'FAKE'},{permission:'ALL'},{from:''},{until:''},{until:'2020-01-01'},{until:input.from},{from:input.until},{target:'HOSP-A'}])assert.equal(sharingDraftModel({...input,...changes},now).valid,false);
});
test('draft preserves chosen purpose, operations and dates across refresh and invalid dates cannot continue',()=>{
 const {fields,root,document}=fixture(),old=globalThis.document;globalThis.document=document;let prepared=0;
 try{const ui=createPatientSharing({root,onPrepare:()=>prepared++,onRevoke(){}});ui.update([study],[]);fields['sharing-target'].value='HOSP-B';fields['sharing-purpose'].value='CONSULTATION';fields['sharing-permission'].value='DOWNLOAD_ALLOWED';fields['sharing-from'].value='2030-01-01T10:00';fields['sharing-until'].value='2030-01-02T10:00';fields['sharing-until'].oninput();ui.update([study],[consent]);assert.equal(fields['sharing-purpose'].value,'CONSULTATION');assert.equal(fields['sharing-permission'].value,'DOWNLOAD_ALLOWED');assert.equal(fields['sharing-until'].value,'2030-01-02T10:00');assert.match(fields['sharing-draft-status'].textContent,/자료를 저장/);fields['sharing-prepare'].onclick();assert.equal(prepared,1);fields['sharing-until'].value='';fields['sharing-until'].oninput();assert.equal(fields['sharing-prepare'].disabled,true);fields['sharing-prepare'].onclick();assert.equal(prepared,1);}finally{globalThis.document=old;}
});
test('recipient options exclude the source; unconfigured hospitals cannot be selected',()=>{assert.deepEqual(recipientChoices('HOSP-A').map(row=>row.id),['HOSP-B','HOSP-C']);assert.deepEqual(recipientChoices('HOSP-C').map(row=>row.id),['HOSP-A','HOSP-B']);});
test('current and expired sharing use actual scopes, permissions and time',()=>{const model=sharingConsentModel(consent,[study],Date.parse('2026-10-11'));assert.equal(model.state.state,'ACTIVE');assert.equal(model.title,'복부 CT');assert.equal(model.permission,'영상 열람만');assert.equal(sharingConsentModel({...consent,validUntil:'2026-01-01'},[study]).state.state,'EXPIRED');assert.equal(sharingConsentModel({...consent,scopes:[{studyInstanceUid:'2.25.1',allowed:false}]},[study]).selected.length,0);});
function fixture(){const make=tag=>({tag,children:[],value:'',textContent:'',append(...rows){this.children.push(...rows);},replaceChildren(...rows){this.children=rows;},setAttribute(){},focus(){}});const fields=Object.fromEntries(['sharing-current','sharing-past','sharing-study','sharing-target','sharing-prepare','sharing-purpose','sharing-permission','sharing-from','sharing-until','sharing-draft-status'].map(id=>[id,make('div')]));fields['sharing-purpose'].value='TRANSFER';fields['sharing-permission'].value='VIEW_ONLY';return {fields,root:{querySelector:s=>fields[s.slice(1)]},document:{createElement:make,createElementNS:(_,tag)=>make(tag)}};}
test('selection only prepares a new review; preserves drafts across polling and blocks source, tamper and busy actions',()=>{const {fields,root,document}=fixture(),old=globalThis.document;globalThis.document=document;let calls=[];try{const ui=createPatientSharing({root,onPrepare:(...args)=>calls.push(args),onRevoke(){}});ui.update([study],[consent]);const target=fields['sharing-target'],prepare=fields['sharing-prepare'];assert.equal(prepare.disabled,true);target.value='HOSP-C';target.onchange();assert.equal(calls.length,0);ui.update([study],[{...consent,validUntil:'2098-01-01'}]);assert.equal(target.value,'HOSP-C');prepare.onclick();assert.equal(calls[0][0],study);assert.equal(calls[0][1],'HOSP-C');assert.equal(calls[0][2].purpose,'TRANSFER');assert.equal(calls[0][2].permission,'VIEW_ONLY');target.value='HOSP-A';prepare.onclick();assert.equal(calls.length,1);target.value='HOSP-X';prepare.onclick();assert.equal(calls.length,1);ui.update([study],[consent],true);target.value='HOSP-C';prepare.onclick();assert.equal(calls.length,1);assert.equal(prepare.disabled,true);}finally{globalThis.document=old;}});
test('new management page has no network, credential storage or automatic grant/QR creation',()=>{const source=readFileSync('public/ui/patient-sharing.js','utf8');assert.doesNotMatch(source,/fetch\(|postJson|innerHTML|localStorage|handoff-ticket/);const html=readFileSync('public/index.html','utf8');assert.equal((html.match(/id="target-hospital-select"/g)||[]).length,1);assert.match(html,/data-route="sharing"/);});

test('period presets change only draft and respect busy, invalid start, manual dates and source identity',()=>{
 const {fields,root,document}=fixture(),old=globalThis.document;globalThis.document=document;
 const make=()=>({children:[],attributes:{},append(...rows){this.children.push(...rows);},replaceChildren(...rows){this.children=rows;},setAttribute(k,v){this.attributes[k]=v;}});
 for(const id of ['sharing-period-options','sharing-study-preview','sharing-summary-title','sharing-summary-route','sharing-permission-hint'])fields[id]=make();
 let calls=0;
 try{
  const ui=createPatientSharing({root,onPrepare:()=>calls++,onRevoke(){}});ui.update([study],[]);
  const presets=fields['sharing-period-options'].children;
  fields['sharing-from'].value='2030-01-01T10:00';presets[1].onclick();
  assert.equal(fields['sharing-until'].value,'2030-01-04T10:00');assert.equal(calls,0);
  fields['sharing-target'].value='HOSP-B';fields['sharing-target'].onchange();
  assert.equal(fields['sharing-summary-title'].textContent,'B대학병원에 공유할 내용');
  assert.equal(fields['sharing-summary-route'].textContent,'A대학병원 → B대학병원');
  fields['sharing-from'].value='';presets[0].onclick();assert.equal(fields['sharing-until'].value,'2030-01-04T10:00');
  ui.update([study],[],true);const before=fields['sharing-until'].value;presets[2].onclick();assert.equal(fields['sharing-until'].value,before);assert.ok(presets.every(p=>p.disabled));assert.equal(calls,0);
 }finally{globalThis.document=old;}
});

test('wallet geometry and card skin are shared, locally hosted and PWA cache versioned',()=>{
 const css=readFileSync('public/ui/sharing-wallet-v2.css','utf8');
 for(const file of ['public/index.html','public/mobile/index.html','public/mobile/sw.js'])assert.match(readFileSync(file,'utf8'),/sharing-wallet-v2.css/);
 for(const name of ['back','front','mobile-back','mobile-front']){
  const file=`mediq-wallet-model-${name}.webp`,asset=readFileSync(`public/images/${file}`);
  assert.equal(asset.toString('ascii',8,12),'WEBP');assert.ok(asset.length<2097152);assert.ok(css.includes(file));
  assert.ok(readFileSync('public/mobile/sw.js','utf8').includes(file));
 }
 assert.doesNotMatch(css,/mediq-sharing-wallet-v2.svg|mediq-sharing-pocket-v2.svg|linear-gradient/);
 assert.match(css,/pointer-events:none/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/max-width:420px/);
});

test('wallet UI assets match the actual Blender model and lossless render manifest',()=>{
 const manifest=JSON.parse(readFileSync('assets/wallet-3d/ui-v1/web-manifest.json','utf8'));
 const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 assert.equal(hash(manifest.sourceModel),manifest.modelSha256);
 assert.equal(manifest.encoding,'lossless WebP');
 assert.equal(Object.keys(manifest.files).length,4);
 for(const [name,entry] of Object.entries(manifest.files))assert.equal(hash(`public/images/${name}`),entry.sha256);
});
