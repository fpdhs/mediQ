import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanQuestion,QUESTION_TEMPLATES,createPatientHelper,helperSourceUrl,shortVisitQuestion,helperRequestErrorMessage} from '../public/ui/patient-helper.js';
import {syntheticHealthRecords} from '../src/synthetic-health-records.js';
test('source cards allow only fixed KDCA content URLs, never arbitrary model links',()=>{
  const url='https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444';
  assert.equal(helperSourceUrl(url),url);
  for(const bad of ['javascript:alert(1)',url.replace('health.kdca.go.kr','evil.example'),url+'&next=evil',url+'#x',url.replace('5444','bad'),'http://health.kdca.go.kr']){
    assert.equal(helperSourceUrl(bad),null);
  }
});
test('KDCA source guide renders attribution, context, license and non-AI questions',async()=>{
  const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try {
    const root=new Element('main');createPatientHelper(root,{ask:async()=>({status:'SOURCE_GUIDANCE',answer:'원문 안내',
      sources:[{institution:'질병관리청',title:'간경변증',section:'정기 진찰',updatedAt:'2026-06-08',
        contextNote:'개인 진단이 아닙니다.',licenseLabel:'출처표시·상업적이용금지·변경금지',
        url:'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6560'}],questions:['어떤 정보를 확인하나요?']})});
    const find=cls=>descendants(root).find(el=>el.className===cls);
    find('helper-manual-input').value='AFP';await find('helper-add-form').dispatch('submit');
    assert.equal(find('helper-source').target,'_blank');
    assert.equal(find('helper-source').rel,'noopener noreferrer');
    assert.ok(descendants(root).some(el=>el.className==='helper-note helper-source-context'&&el.textContent==='개인 진단이 아닙니다.'));
    assert.ok(descendants(root).some(el=>el.textContent==='출처표시·상업적이용금지·변경금지'));
    assert.ok(descendants(root).some(el=>el.textContent==='개인 진단이 아닙니다.'));
    assert.ok(descendants(root).some(el=>el.textContent.includes('AI 추천 아님')));
    descendants(root).find(el=>el.textContent==='+ 담기').dispatch('click');
    assert.equal(find('helper-question-input').value,'어떤 정보를 확인하나요?');
  } finally {globalThis.document=prior;}
});
test('synthetic HCC provenance status renders without source links or AI suggestions',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const root=new Element('main');createPatientHelper(root,{ask:async()=>({status:'SYNTHETIC_SCENARIO',
   answer:'발표용 합성 사례입니다. 실제 진단 근거가 아닙니다.',sources:[],questions:[],generationUsed:false,clinicalUse:false,synthetic:true,
   scenarioEvidence:{version:'hong-gildong-health-20261011-v1',presentationId:'HONG_GILDONG_SYNTHETIC_56',diagnosisOrigin:'PRESENTATION_SETUP',
    recordIds:['demo-2026-10-08-CHECKUP','demo-2025-10-08-AFP','demo-2026-04-08-AFP','demo-2026-10-08-AFP','demo-2025-10-08-ULTRASOUND','demo-2026-04-08-ULTRASOUND','demo-2026-10-08-ULTRASOUND'],
    records:[{id:'demo-2026-10-08-CHECKUP',kind:'CHECKUP',date:'2026-10-08'},
     {id:'demo-2025-10-08-AFP',kind:'AFP',date:'2025-10-08'},{id:'demo-2026-04-08-AFP',kind:'AFP',date:'2026-04-08'},
     {id:'demo-2026-10-08-AFP',kind:'AFP',date:'2026-10-08'},{id:'demo-2025-10-08-ULTRASOUND',kind:'ULTRASOUND',date:'2025-10-08'},
     {id:'demo-2026-04-08-ULTRASOUND',kind:'ULTRASOUND',date:'2026-04-08'},{id:'demo-2026-10-08-ULTRASOUND',kind:'ULTRASOUND',date:'2026-10-08'}]}})});
  const find=cls=>descendants(root).find(el=>el.className===cls);
  find('helper-manual-input').value='AFP와 간 초음파 자료는 간암 사례와 어떻게 연결되나요?';await find('helper-add-form').dispatch('submit');
  assert.equal(find('helper-answer').textContent,'발표용 합성 사례입니다. 실제 진단 근거가 아닙니다.');
  assert.equal(descendants(root).find(el=>el.attributes?.role==='status')?.textContent,
   '합성 발표 시나리오의 출처 설명 · AI 생성 및 임상 해석 아님.');
  const panel=find('helper-evidence-drawer helper-scenario-evidence');assert.ok(panel);
  assert.equal(descendants(panel).find(el=>el.tag==='summary').textContent,'합성 기록 근거 · 7건');
  assert.ok(descendants(panel).some(el=>el.textContent==='자료 버전: hong-gildong-health-20261011-v1'));
  assert.ok(descendants(panel).some(el=>el.textContent.includes('간 관련 건강검진 · 2026-10-08 · 기록 ID demo-2026-10-08-CHECKUP')));
  assert.ok(descendants(panel).some(el=>el.textContent.includes('간암 전원 설정: HONG_GILDONG_SYNTHETIC_56 · PRESENTATION_SETUP')));
  assert.equal(descendants(root).some(el=>el.className==='helper-source-card'),false);
 }finally{globalThis.document=prior;}
});
test('scenario evidence drawer rejects malformed provenance and renders supplied values only as text',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const root=new Element('main');createPatientHelper(root,{ask:async()=>({status:'SYNTHETIC_SCENARIO',answer:'합성 사례',synthetic:true,generationUsed:false,clinicalUse:false,
   scenarioEvidence:{version:'v1',presentationId:'<img src=x>',diagnosisOrigin:'PRESENTATION_SETUP',recordIds:['<img src=x>'],records:[{id:'<img src=x>',kind:'AFP',date:'2026-10-08'}]}})});
  const find=cls=>descendants(root).find(el=>el.className===cls);
  find('helper-manual-input').value='합성 질문';await find('helper-add-form').dispatch('submit');
  assert.equal(descendants(root).some(el=>el.className==='helper-evidence-drawer helper-scenario-evidence'),false);
  assert.equal(descendants(root).some(el=>el.tag==='img'),false);
 }finally{globalThis.document=prior;}
});
test('MRI list source guidance renders structured source fragments and provenance note as inert text',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try {
  const heading='MRI 전에는 다음과 같은 물품을 제거해야 합니다.',item='장신구와 시계';
  const contextNote='한국어 번역의 목록 안내와 항목을 원문 조각별로 나누어 표시합니다. 문장부호를 새로 덧붙이지 않았으며, 원문 전체 페이지의 임상적 적용 여부는 별도로 확인해야 합니다.';
  const root=new Element('main');createPatientHelper(root,{ask:async()=>({status:'SOURCE_GUIDANCE',responseMode:'SOURCE_GUIDANCE_LIST_CONTEXT',
   answer:'질문과 관련된 목록 안내와 항목을 번역 후보로 나누어 표시합니다. 본인에게 적용되는지는 의료진에게 확인해 주세요.',
   generationUsed:false,sources:[{institution:'MedlinePlus · 미국 국립의학도서관',title:'자기공명영상(MRI)',
    section:'MRI 준비',contextNote,listContexts:[{heading,items:[item]}],licenseLabel:'Source: MedlinePlus, National Library of Medicine.',
    url:'https://medlineplus.gov/mriscans.html'}],questions:['진료에서 무엇을 확인하면 좋을까요?']})});
  const find=cls=>descendants(root).find(el=>el.className===cls);
  find('helper-manual-input').value='MRI 전에 장신구를 제거해야 하나요?';await find('helper-add-form').dispatch('submit');
  assert.equal(find('helper-answer').textContent,'질문과 관련된 목록 안내와 항목을 번역 후보로 나누어 표시합니다. 본인에게 적용되는지는 의료진에게 확인해 주세요.');
  assert.ok(descendants(root).some(el=>el.className==='helper-note helper-source-context'&&el.textContent===contextNote));
  const listSection=find('helper-source-list-context');assert.ok(listSection);
  assert.equal(listSection.tag,'section');assert.equal(listSection.attributes['aria-label'],'원문 목록 안내와 항목');
  assert.ok(descendants(listSection).some(el=>el.className==='helper-note helper-source-list-heading'&&el.textContent===heading));
  assert.ok(descendants(listSection).some(el=>el.tag==='ul'));
  assert.ok(descendants(listSection).some(el=>el.tag==='li'&&el.textContent===item));
  assert.equal(descendants(root).some(el=>el.textContent===`${heading}: ${item}.`),false);
  assert.ok(descendants(root).some(el=>el.textContent==='원문 링크 안내 · AI 생성 답변 아님 · 질문은 프로젝트 예시입니다.'));
  assert.equal(descendants(root).some(el=>el.className==='helper-claim-evidence'),false);
 } finally {globalThis.document=prior;}
});
test('unreviewed MRI question shows the patient-safe insufficient-evidence state with no citation card',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const root=new Element('main');createPatientHelper(root,{ask:async()=>({status:'INSUFFICIENT_EVIDENCE',
   answer:'이 질문에 사용할 검토된 근거가 아직 준비되지 않았어요. 의료진에게 확인해 주세요.',sources:[],questions:[],
   recordContext:'NOT_CONNECTED'})});
  const find=cls=>descendants(root).find(el=>el.className===cls);
  find('helper-manual-input').value='MRI 전에 장신구를 제거해야 하나요?';
  await find('helper-add-form').dispatch('submit');
  assert.equal(find('helper-answer').textContent,'이 질문에 사용할 검토된 근거가 아직 준비되지 않았어요. 의료진에게 확인해 주세요.');
  assert.equal(descendants(root).find(el=>el.attributes?.role==='status')?.textContent,
   '질문에 답할 근거가 부족해요. 현재 지원하는 주제를 확인해 주세요.');
  assert.equal(descendants(root).some(el=>el.className==='helper-source-card'),false);
  assert.equal(descendants(root).some(el=>el.className==='helper-claim-evidence'),false);
 }finally{globalThis.document=prior;}
});
test('RAG claim quotes render as text, never as executable markup',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try {
  const root=new Element('main');createPatientHelper(root,{ask:async()=>({status:'GENERATED',answer:'합성 답변 문장입니다.',questions:[],sources:[],
   claimEvidence:[{text:'합성 답변 문장입니다.',evidenceId:'E1',quote:'<img src=x onerror=alert(1)>'}]})});
  const find=cls=>descendants(root).find(el=>el.className===cls);
  find('helper-manual-input').value='합성 질문';await find('helper-add-form').dispatch('submit');
  const panel=find('helper-evidence-drawer helper-claim-evidence');assert.ok(panel);
  assert.ok(descendants(panel).some(el=>el.tag==='blockquote'&&el.textContent==='근거 원문 발췌: <img src=x onerror=alert(1)>'));
  assert.equal(descendants(panel).some(el=>el.tag==='img'),false);
 } finally {globalThis.document=prior;}
});
test('question notes reject non-string and bound length',()=>{
  assert.equal(cleanQuestion(null),''); assert.equal(cleanQuestion({}),'');
  assert.equal(cleanQuestion('  질문  '),'질문'); assert.equal(cleanQuestion('가'.repeat(300)).length,240);
  assert.equal(new Set(QUESTION_TEMPLATES).size,3);
});
test('helper request failures give safe next steps without exposing backend details',()=>{
  assert.match(helperRequestErrorMessage(Object.assign(new Error('JWT_EXPIRED'),{code:'JWT_EXPIRED'})),/다시 로그인/u);
  assert.match(helperRequestErrorMessage(Object.assign(new Error('HELPER_MODEL_UNAVAILABLE'),{code:'HELPER_MODEL_UNAVAILABLE'})),/다시 시도/u);
  assert.match(helperRequestErrorMessage(Object.assign(new Error('HELPER_OUTPUT_REJECTED'),{code:'HELPER_OUTPUT_REJECTED'})),/안전 확인/u);
  assert.match(helperRequestErrorMessage(Object.assign(new Error('HELPER_RATE_LIMITED'),{code:'HELPER_RATE_LIMITED'})),/조금 뒤/u);
  assert.doesNotMatch(helperRequestErrorMessage(new Error('INTERNAL_SECRET_OR_STACK')),/INTERNAL_SECRET|STACK/u);
});
test('helper retains typed question and saved notes when the authenticated request fails',async()=>{
  const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try {
    const root=new Element('main');createPatientHelper(root,{ask:async()=>{throw Object.assign(new Error('JWT_EXPIRED'),{code:'JWT_EXPIRED'});}});
    const find=cls=>descendants(root).find(el=>el.className===cls);
    const label=text=>descendants(root).find(el=>el.textContent===text);
    label('+ 담기').dispatch('click');
    find('helper-manual-input').value='AFP는 어떤 검사인가요?';
    await find('helper-add-form').dispatch('submit');
    const status=descendants(root).find(el=>el.attributes?.role==='status');
    assert.match(status.textContent,/다시 로그인/u);
    assert.equal(find('helper-manual-input').value,'AFP는 어떤 검사인가요?');
    assert.equal(find('helper-saved').children.length,1);
  } finally {globalThis.document=prior;}
});

// Minimal DOM test double: application state/events, not visual browser evidence.
class Element {
  constructor(tag) {this.tag=tag;this.children=[];this.listeners={};this.value='';this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes??={};this.attributes[name]=value;}
  addEventListener(name,handler){this.listeners[name]=handler;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  get childElementCount(){return this.children.length;}
  dispatch(name){return this.listeners[name]?.({preventDefault(){}});}
}
function descendants(root){return [root,...root.children.flatMap(descendants)];}

test('comparison dates retain notes, numeric values never accompany the AI comparison request, reset clears numbers',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const root=new Element('main');let sent;
  const helper=createPatientHelper(root,{getComparisons:syntheticHealthRecords,ask:async q=>{sent=q;return {status:'VISIT_PREPARATION',answer:'질문 준비',questions:['어떤 기록을 확인할까요?'],sources:[]};}});
  const find=cls=>descendants(root).find(e=>e.className===cls),label=text=>descendants(root).find(e=>e.textContent===text);
  helper.selectMetric('혈청 AFP');
  assert.equal(find('helper-number').textContent,'6.2');assert.match(find('helper-change-strip').textContent,/18\.4/);
  label('+ 담기').dispatch('click');label('이 변화에 대해 질문하기').dispatch('click');await find('helper-add-form').dispatch('submit');
  assert.match(sent,/AFP.*이전/);assert.doesNotMatch(sent,/6\.2|24\.6|2025|2026/);
  helper.selectMetric('공복혈당');assert.equal(find('helper-question-input').value,QUESTION_TEMPLATES[0]);
  helper.reset();assert.equal(find('helper-comparison-body').children.length,0);
 }finally{globalThis.document=prior;}
});
test('explicitly named CT and ultrasound questions are never silently rewritten as the selected AFP topic',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try {
  const root=new Element('main'),question='CT와 초음파 중 어떤 검사가 더 정확한가요?';let sent;
  const helper=createPatientHelper(root,{getComparisons:syntheticHealthRecords,ask:async q=>{sent=q;return {status:'INSUFFICIENT_EVIDENCE',answer:'근거가 부족합니다.',sources:[],questions:[]};}});
  helper.selectMetric('혈청 AFP');
  const find=cls=>descendants(root).find(el=>el.className===cls);
  find('helper-manual-input').value=question;await find('helper-add-form').dispatch('submit');
  assert.equal(sent,question);
 } finally {globalThis.document=prior;}
});
test('intent selection makes no API call, notes take priority, shorter examples are reversible',()=>{
  const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try {
    const root=new Element('main');let calls=0;
    createPatientHelper(root,{ask:()=>{calls++;},surface:'mobile',getRecords:()=>[
      {id:'afp-1',kind:'AFP',title:'혈청 AFP'}, {id:'afp-2',kind:'AFP',title:'혈청 AFP'},
    ]});
    const find=cls=>descendants(root).find(el=>el.className===cls);
    const labelled=text=>descendants(root).find(el=>el.textContent===text);
    assert.equal(find('helper-record-select').children.length,1,'topic selector does not duplicate dated patient records');
    labelled('이전 결과와 비교').dispatch('click');
    assert.equal(calls,0);assert.match(find('helper-manual-input').value,/비교/);
    assert.equal(labelled('이전 결과와 비교').attributes['aria-pressed'],'true');
    assert.equal(find('helper-sheets').children[0].className,'helper-suggestion-group');
    const first=find('helper-suggestions').children[0],original=first.children[1].textContent;
    descendants(first).find(el=>el.textContent==='더 짧게').dispatch('click');
    assert.equal(first.children[1].textContent,shortVisitQuestion(original));
    descendants(first).find(el=>el.textContent==='원문으로').dispatch('click');
    assert.equal(first.children[1].textContent,original);
    descendants(first).find(el=>el.textContent==='+ 담기').dispatch('click');
    assert.equal(find('helper-sheets').children[0].className,'helper-saved-group');
    assert.equal(descendants(root).find(el=>el.className?.includes('helper-notes-jump')).textContent,'내 질문 1개 보기');
    assert.equal(calls,0);
    assert.equal(shortVisitQuestion('내가 직접 적은 질문'), '내가 직접 적은 질문');
  } finally {globalThis.document=prior;}
});
test('new conversation and record change preserve edited notes; reset clears them',async()=>{
  const prior=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  try {
    const root=new Element('main');
    let resolve;
    const helper=createPatientHelper(root,{getRecords:()=>[{id:'afp',kind:'AFP',title:'혈청 AFP',date:'2026-10-08',synthetic:true}],ask:()=>new Promise(done=>{resolve=done;})});
    const find=cls=>descendants(root).find(el=>el.className===cls);
    const labelled=text=>descendants(root).find(el=>el.textContent===text);
    const take = labelled('+ 담기');
    take.dispatch('click');
    take.dispatch('click');
    assert.equal(find('helper-saved').children.length,1,'duplicate not saved');
    const edit=find('helper-question-input'); edit.value='진료 전에 무엇을 준비할까요?';edit.dispatch('input');
    find('helper-manual-input').value='AFP는 어떤 검사인가요?';
    const pending=find('helper-add-form').dispatch('submit');
    labelled('↻ 새 대화').dispatch('click');
    resolve({answer:'LATE RESPONSE',status:'GENERATED',questions:['늦은 질문'],sources:[]});
    await pending;
    assert.equal(find('helper-answers').children.length,0,'late response discarded');
    assert.equal(find('helper-question-input').value,'진료 전에 무엇을 준비할까요?');
    find('helper-record-select').dispatch('change');
    assert.equal(find('helper-saved').children.length,1);
    labelled('질문 모아보기 ↗').dispatch('click');
    assert.equal(find('helper-notes-dialog').open,true);
    assert.equal(find('helper-notes-list').children[0].textContent,'진료 전에 무엇을 준비할까요?');
    find('helper-manual-input').value='잠금 전에 입력한 질문';
    helper.reset();
    assert.equal(find('helper-notes-dialog').open,false);
    assert.equal(find('helper-notes-list').children.length,0,'hidden dialog must not retain previous notes');
    assert.equal(find('helper-manual-input').value,'','manual draft cleared on lock');
    assert.equal(find('helper-saved').children[0].className,'helper-empty');
  } finally {globalThis.document=prior;}
});

test('saved recommendations disappear, edits retain identity, undo restores order on web and mobile',async()=>{
 const prior=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try {for(const surface of ['web','mobile']) {
  const root=new Element('main');createPatientHelper(root,{surface});
  const find=cls=>descendants(root).find(el=>el.className===cls);
  const label=text=>descendants(root).find(el=>el.textContent===text);
  const take=label('+ 담기');await take.dispatch('click');await take.dispatch('click');
  assert.equal(find('helper-suggestions').children.length,2);
  assert.equal(find('helper-saved').children.length,1);
  const edit=find('helper-question-input');edit.value='수정한 질문';edit.dispatch('input');
  label('↻ 새 대화').dispatch('click');
  assert.equal(find('helper-suggestions').children.length,2,'edited note keeps original suggestion hidden');
  label('실행 취소').dispatch('click');
  assert.equal(find('helper-suggestions').children[0].children[1].textContent,QUESTION_TEMPLATES[0]);
  for(let i=0;i<3;i++)await label('+ 담기').dispatch('click');
  assert.ok(label('준비한 질문을 모두 담았어요.'));
  assert.ok(label('내 질문 확인'));
  label('삭제').dispatch('click');
  assert.equal(find('helper-suggestions').children.length,1);
 }}finally{globalThis.document=prior;}
});

test('full notes retain recommendation and draft; reduced motion skips animation; stale animation cannot restore data',async()=>{
 const prior=globalThis.document,priorMatch=globalThis.matchMedia;
 globalThis.document={createElement:tag=>new Element(tag)};
 try {
  globalThis.matchMedia=()=>({matches:true});
  const root=new Element('main'),helper=createPatientHelper(root);
  const find=cls=>descendants(root).find(el=>el.className===cls);
  const label=text=>descendants(root).find(el=>el.textContent===text);
  const card=find('helper-suggestions').children[0];card.animate=()=>{throw new Error('reduced motion ignored');};
  await label('+ 담기').dispatch('click');
  const forms=descendants(root).filter(el=>el.className==='helper-add-form'),manual=forms[1];
  for(let i=0;i<11;i++){manual.children[0].value=`직접 질문 ${i}`;manual.dispatch('submit');}
  await label('+ 담기').dispatch('click');assert.equal(find('helper-suggestions').children.length,2);
  manual.children[0].value='남겨둘 초안';manual.dispatch('submit');assert.equal(manual.children[0].value,'남겨둘 초안');
  helper.reset();globalThis.matchMedia=()=>({matches:false});
  let finish;find('helper-suggestions').children[0].animate=()=>({finished:new Promise(resolve=>{finish=resolve;})});
  const pending=label('+ 담기').dispatch('click');helper.reset();finish();await pending;
  assert.equal(find('helper-suggestions').children.length,3);
  assert.equal(find('helper-saved').children[0].className,'helper-empty');
  assert.equal(label('실행 취소').hidden,true);
 }finally{globalThis.document=prior;globalThis.matchMedia=priorMatch;}
});
test('helper uses injected server API without browser keys, storage or HTML injection',()=>{
  const source=readFileSync('public/ui/patient-helper.js','utf8');
  assert.doesNotMatch(source,/innerHTML|fetch\(|localStorage|sessionStorage|eval\(/);
  assert.match(source,/AI 추천 아님/); assert.match(source,/HELPER_MODEL_NOT_CONFIGURED/);
  assert.match(source,/sequence !== generation/); assert.match(source,/activeController.abort/);
  assert.match(source,/textContent = text/); assert.match(source,/questions.length >= 12/);
  assert.match(source,/input.addEventListener\('input'/);
});
test('helper route and scoped sage surface are integrated',()=>{
  const html=readFileSync('public/index.html','utf8'),css=readFileSync('public/ui/patient-helper.css','utf8');
  assert.match(html,/data-route="helper"/); assert.match(html,/data-page="helper" hidden/);
  assert.match(css,/--question-pocket:#dfe9dd/); assert.match(css,/--question-card:#fafcf8/);
  assert.match(css,/focus-visible/); assert.match(css,/max-width:960px/);
});
