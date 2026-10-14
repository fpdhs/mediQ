import {comparisonMetrics,compareHealthPoints,formatHealthNumber} from './health-comparison.js';
// Session-only notes and server-grounded explanations; no browser model credentials.
export const QUESTION_TEMPLATES = Object.freeze([
  '이전 검사 결과와 비교해 어떤 변화가 있나요?',
  '검사 간격이 달라도 수치를 비교할 수 있나요?',
  '다른 검사와 함께 어떻게 이해하면 되나요?',
]);
export function cleanQuestion(value) {
  return typeof value === 'string' ? value.trim().slice(0, 240) : '';
}
// Project-authored alternatives, not a second model call or a medical summary.
export function shortVisitQuestion(value) {
  const question = cleanQuestion(value);
  if (/비교|변화/u.test(question)) return '이전 검사와 비교할 때 무엇을 확인하나요?';
  if (/준비|가져|챙/u.test(question)) return '다음 진료에 무엇을 준비할까요?';
  if (/목적|무엇을 확인|어떤 검사/u.test(question)) return '이 검사는 무엇을 확인하나요?';
  return question;
}
export function helperRequestErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
  if (error?.name === 'AbortError' || ['HELPER_MODEL_TIMEOUT','HELPER_REQUEST_TIMEOUT'].includes(code))
    return '답변이 늦어져 연결을 마쳤어요. 입력한 질문은 남아 있으니 잠시 후 다시 시도해 주세요.';
  if (['CAPSTONE_SESSION_EXPIRED','JWT_EXPIRED','AUTHENTICATION_REQUIRED','HELPER_PATIENT_REQUIRED','CAPSTONE_AUTH_REQUIRED'].includes(code))
    return '로그인 시간이 끝났어요. 다시 로그인한 뒤 질문을 이어가 주세요. 입력한 질문은 남아 있습니다.';
  if (code === 'HELPER_OUTPUT_REJECTED')
    return '안전 확인을 통과하지 못해 이번 답변은 표시하지 않았어요. 입력한 질문은 남아 있습니다.';
  if (code === 'HELPER_RATE_LIMITED')
    return '질문 요청이 잠시 많아요. 조금 뒤에 다시 시도해 주세요. 담은 질문은 그대로예요.';
  if (['HELPER_MODEL_NOT_CONFIGURED','HELPER_MODEL_UNAVAILABLE','HELPER_UNAVAILABLE','HELPER_REQUEST_FAILED'].includes(code))
    return '건강 설명 연결을 잠시 사용할 수 없어요. 조금 뒤에 다시 시도해 주세요. 담은 질문은 그대로예요.';
  return '답변 연결을 확인하지 못했어요. 잠시 후 다시 시도해 주세요. 담은 질문은 그대로예요.';
}
export function helperSourceUrl(value) {
  try {
    const url = new URL(value);
    const fdaSource='https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication';
    const fdaPolicy='https://www.fda.gov/about-fda/about-website/website-policies';
    const medlinePlusPolicy='https://medlineplus.gov/about/using/usingcontent/';
    if(url.protocol==='https:'&&url.hostname==='medlineplus.gov'&&!url.port&&!url.username&&!url.password
      &&!url.search&&!url.hash&&url.href===medlinePlusPolicy)return url.href;
    if(url.protocol==='https:'&&url.hostname==='www.fda.gov'&&!url.port&&!url.username&&!url.password
      &&!url.search&&!url.hash&&[fdaSource,fdaPolicy].includes(url.href))return url.href;
    if (url.protocol === 'https:' && url.hostname === 'medlineplus.gov' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && (/^\/[a-z0-9]+\.html$/u.test(url.pathname)
        || MEDICAL_TEST_PATHS.has(url.pathname))
      && !['/highbloodpressure.html','/insomnia.html'].includes(url.pathname)) return url.href;
    const path = '/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do';
    if (url.protocol !== 'https:' || url.hostname !== 'health.kdca.go.kr' || url.port
      || url.username || url.password || url.pathname !== path || url.hash
      || [...url.searchParams.keys()].join(',') !== 'cntnts_sn'
      || !/^[0-9]{1,8}$/.test(url.searchParams.get('cntnts_sn'))) return null;
    return url.href;
  } catch { return null; }
}
const MEDICAL_TEST_PATHS=new Set(['obesity-screening','measuring-blood-pressure','vision-screening','hearing-tests-for-adults',
 'hemoglobin-test','blood-glucose-test','ast-test','alt-blood-test','gamma-glutamyl-transferase-ggt-test','creatinine-test',
 'estimated-glomerular-filtration-rate-egfr-and-gfr-tests','protein-in-urine','cholesterol-levels','triglycerides-test',
 'hepatitis-testing','lung-function-tests','dental-exam','alpha-fetoprotein-afp-tumor-marker-test','sonogram',
 'how-to-understand-your-lab-results','liver-function-tests'].map(p=>`/lab-tests/${p}/`));
const EXPLICIT_MEDICAL_TOPIC = /\b(?:AFP|AST|SGOT|ALT|SGPT|GGT|GTP|CT|MRI|BMI|eGFR|A1C)\b|간\s*초음파|초음파|컴퓨터\s*단층|엑스레이|X[- ]?선|혈압|혈당|체중|허리둘레|크레아티닌|헤모글로빈|혈색소|콜레스테롤|중성지방|요단백|간염|폐기능|시력|청력|구강검진|건강검진/iu;
const SCENARIO_RECORD_LABELS = Object.freeze({
  CHECKUP: '간 관련 건강검진', AFP: '혈청 AFP', ULTRASOUND: '간 초음파',
});
export function createPatientHelper(root, {navigate, ask, getRecords, getComparisons, recordStatus, retryRecords, surface = 'web'} = {}) {
  if (!root) return;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag); el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (label, action, cls = 'helper-button') => {
    const el = node('button', cls, label); el.type = 'button'; el.addEventListener('click', action); return el;
  };
  const header = node('header', 'helper-heading');
  header.append(node('h1', '', '건강도우미'),
    node('p', '', '내 기록을 알기 쉽게, 다음 진료를 준비해요.'));
  header.append(button('↻ 새 대화', () => newConversation(), 'helper-button helper-new-chat'));
  const grid = node('div', 'helper-grid');
  const chat = node('section', 'helper-conversation');
  chat.setAttribute('aria-label', '건강도우미 안내');
  const context = node('div', 'helper-context');
  const recordSelect = node('select', 'helper-record-select');
  recordSelect.setAttribute('aria-label', '함께 보는 기록 선택');
  const contextNote = node('span', 'helper-context-note', '검사 주제로 질문을 연결해요 · 기록 수치·식별정보는 AI에 전달하지 않아요');
  context.append(node('strong', '', '함께 볼 검사'), recordSelect);
  if (surface !== 'mobile') context.append(button('기록 보기 ↗', () => navigate?.('phr')));
  context.append(contextNote, node('span', 'helper-context-hint', '검사를 바꾸면 새 대화가 시작됩니다. 담은 질문은 유지돼요.'));
  const comparison=node('section','helper-comparison');comparison.setAttribute('aria-label','내 검사 변화');
  let metrics=[];
  const fromSelect=node('select','helper-compare-date'),toSelect=node('select','helper-compare-date');
  fromSelect.setAttribute('aria-label','이전 검사 날짜');toSelect.setAttribute('aria-label','이번 검사 날짜');
  const dates=node('div','helper-comparison-dates');dates.append(node('span','','비교할 날짜'),fromSelect,node('span','','→'),toSelect);
  const comparisonBody=node('div','helper-comparison-body');
  comparison.append(node('h2','','내 검사 변화'),node('p','helper-note','합성 시연 데이터 · 숫자 비교이며 진단이 아닙니다.'),dates,comparisonBody);
  function selectedMetric(){return metrics.find(m=>m.id===recordSelect.value);}
  function drawComparison(resetDates=false){
    comparisonBody.replaceChildren(); const metric=selectedMetric();
    dates.hidden=!metric;
    if(!metric){
      comparisonBody.append(node('p','helper-note',recordStatus?.()==='ERROR'?'기록을 불러오지 못했어요. 임의 수치로 대체하지 않습니다.':recordStatus?.()==='LOADING'?'인증된 합성 기록을 불러오고 있어요.':'이 검사에는 비교할 수치 기록이 없어요.'));
      if(recordStatus?.()==='ERROR'&&retryRecords)comparisonBody.append(button('기록 다시 불러오기',()=>retryRecords()));
      return;
    }
    if(resetDates){
      fromSelect.replaceChildren();toSelect.replaceChildren();
      for(const point of metric.points){for(const select of [fromSelect,toSelect]){const option=node('option','',point.date);option.value=point.date;select.append(option);}}
      fromSelect.value=metric.points[0]?.date??'';toSelect.value=metric.points.at(-1)?.date??'';
    }
    const previous=metric.points.find(p=>p.date===fromSelect.value),current=metric.points.find(p=>p.date===toSelect.value);
    const result=compareHealthPoints(previous,current);
    const values=node('div','helper-compare-values');
    for(const [label,point] of [['이전 검사',previous],['이번 검사',current]]){
      const value=node('div','helper-compare-value');value.append(node('strong','',label),node('span','helper-note',`${point?.date??'미등록'} · ${point?.hospital??''}`),node('p','helper-number',formatHealthNumber(point?.value)),node('span','helper-unit',point?.unit??''));values.append(value);
    }
    comparisonBody.append(values);
    if(result.status==='NUMERIC'){
      const direction=result.difference>0?'증가':result.difference<0?'감소':'변화 없음';
      const strip=node('p','helper-change-strip',`이전보다 ${formatHealthNumber(Math.abs(result.difference))} ${current.unit} ${direction}`);
      strip.append(node('span','',result.percent===null?'증가율 계산 안 함':`${result.percent>0?'+':''}${formatHealthNumber(result.percent)}%`));comparisonBody.append(strip);
      if(previous.value>=0&&current.value>=0){
        const max=Math.max(1,Math.ceil(Math.max(previous.value,current.value)/10)*10),graph=node('div','helper-comparison-chart');graph.setAttribute('role','img');graph.setAttribute('aria-label',`${metric.title}: ${previous.date} ${previous.value}에서 ${current.date} ${current.value} ${current.unit}. 세로축 0부터 ${max}. 선택한 두 기록만 표시.`);
        graph.append(node('span','helper-chart-top',`${formatHealthNumber(max)} ${current.unit}`),node('span','helper-chart-zero','0'));
        for(const [index,point] of [previous,current].entries()){
          const column=node('div','helper-chart-column');column.style?.setProperty('--point-height',`${point.value/max*100}%`);column.style?.setProperty('--point-x',index===0?'25%':'75%');
          column.append(node('span','helper-chart-dot',formatHealthNumber(point.value)),node('span','helper-chart-date',point.date));graph.append(column);
        }
        comparisonBody.append(graph);
      }
    }
    comparisonBody.append(node('p','helper-note',result.message));
    const detail=node('details','helper-evidence-drawer');detail.append(node('summary','','검사 조건·참고범위 확인'),node('p','helper-note',`합성 검사 방법: ${previous?.method??'미등록'} / ${current?.method??'미등록'}. 기관 참고범위는 미등록입니다. 표시한 변화는 질환 진행이나 호전을 뜻하지 않습니다.`));comparisonBody.append(detail);
    comparisonBody.append(button('이 변화에 대해 질문하기',()=>{generation++;controller?.abort();askButton.disabled=false;askInput.value=`${metric.kind==='CHECKUP'?metric.title:metric.kind} 이전 검사와 이번 검사 차이를 진료에서 어떻게 확인할까요?`;askInput.focus?.();askStatus.textContent='비교 질문을 준비했어요. 수치는 AI에 전달하지 않습니다. 보내기를 눌러 주세요.';},'helper-button helper-button--primary'));
  }
  for(const select of [fromSelect,toSelect])select.addEventListener('change',()=>{newConversation();drawComparison();});
  recordSelect.addEventListener('change', () => {newConversation();drawComparison(true);});
  function refresh() {
    const previous = recordSelect.value;
    recordSelect.replaceChildren();
    metrics=comparisonMetrics(getComparisons?.()??[]);
    const records = (metrics.length?metrics:(getRecords?.() ?? [])).filter((record, index, all) =>
      all.findIndex(item => item.kind === record.kind && item.title === record.title) === index);
    for (const record of records) {
      const option = node('option', '', `${record.title} · 검사 주제`);
      option.value = record.id; recordSelect.append(option);
    }
    if (!records.length) { const option = node('option', '', '기록을 불러온 후 선택할 수 있어요'); option.value = ''; recordSelect.append(option); }
    if (records.some(record => record.id === previous)) recordSelect.value = previous;
    else if (records.some(record => record.kind === 'AFP')) recordSelect.value = records.find(record => record.kind === 'AFP').id;
    if (previous && previous !== recordSelect.value) newConversation();
    drawComparison(true);
  }
  const introduction = node('div', 'helper-introduction');
  introduction.append(node('span', 'helper-mark', 'Q'), node('h2', '', '어떤 점이 궁금하세요?'),
    node('p', '', `검사에 대한 궁금증을 적고, 의료진에게 물어볼 질문을 ${surface === 'mobile' ? '아래' : '오른쪽'} 메모에 챙겨보세요.`),
    node('p', 'helper-availability', '궁금증을 진료 질문으로 정리해요 · 검사 설명은 공식 원문으로 확인해요.'));
  const progress = node('ol', 'helper-progress');
  const steps = ['궁금증 고르기', '대화로 정리하기', '질문 챙기기'].map((label, index) => {
    const step = node('li', '', `${index + 1}. ${label}`); progress.append(step); return step;
  });
  function setStage(stage) { steps.forEach((step, index) => step.setAttribute('aria-current', index === stage ? 'step' : 'false')); }
  const intents = node('div', 'helper-intents'); intents.setAttribute('aria-label', '궁금증 고르기');
  const intentButtons = [
    ['검사 목적', '이 검사는 무엇을 확인하나요?'],
    ['이전 결과와 비교', '이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?'],
    ['다음 진료 준비', '다음 진료에 어떤 기록을 준비하면 좋을까요?'],
  ].map(([label, question]) => {
    const chip = button(label, () => {
      generation++; controller?.abort(); askButton.disabled = false; askInput.value = question; askStatus.textContent = '질문을 골랐어요. 보내기를 누르면 대화를 시작합니다.';
      intentButtons.forEach(item => item.setAttribute('aria-pressed', item === chip ? 'true' : 'false')); setStage(0); askInput.focus?.();
    }, 'helper-button helper-intent'); chip.setAttribute('aria-pressed', 'false'); intents.append(chip); return chip;
  });
  chat.append(node('h2', 'helper-chat-title', '진료 리허설'), progress, intents, introduction);
  const pocket = node('aside', 'helper-pocket'); pocket.setAttribute('aria-labelledby', 'helper-pocket-title');
  const title = node('h2', '', '질문 카드 스튜디오'); title.id = 'helper-pocket-title'; title.tabIndex = -1;
  const suggestionHeading = node('h3', '', '질문 예시 · AI 추천 아님');
  pocket.append(title, node('p', 'helper-pocket-subtitle', '다음 진료에서 물어볼까요? 내 말로 완성하는 질문 메모.'));
  const suggestions = node('div', 'helper-suggestions');
  const savedHeading = node('h3', '', '내가 담은 질문');
  const saved = node('div', 'helper-saved');
  const suggestionGroup = node('section', 'helper-suggestion-group'); suggestionGroup.append(suggestionHeading, suggestions);
  const savedGroup = node('section', 'helper-saved-group'); savedGroup.append(savedHeading, saved);
  const sheets = node('div', 'helper-sheets'); pocket.append(sheets);
  const jump = button('내 질문 0개 보기', () => { pocket.scrollIntoView?.({block:'start',behavior:'auto'}); title.focus?.(); }, 'helper-button helper-notes-jump');
  const status = node('p', 'helper-note'); status.setAttribute('role', 'status');
  const questions = [];
  const origins = new Map();
  let suggestionValues = [], suggestionRevision = 0, lastAdded = null;
  const undo = button('실행 취소', () => {
    if (!lastAdded) return;
    const index = questions.indexOf(lastAdded);
    if (index >= 0) questions.splice(index, 1);
    origins.delete(lastAdded); lastAdded = null; undo.hidden = true;
    render(); drawSuggestions(); status.textContent = '담기를 취소했어요.';
    suggestions.querySelector?.('button')?.focus();
  }); undo.hidden = true;
  function render() {
    saved.replaceChildren(); savedHeading.textContent = `내 진료 질문 · ${questions.length}개`;
    jump.textContent = `내 질문 ${questions.length}개 보기`;
    sheets.replaceChildren(...(questions.length ? [savedGroup, suggestionGroup] : [suggestionGroup, savedGroup]));
    if (!questions.length) saved.append(node('p', 'helper-empty', '진료 때 물어볼 질문을 하나 담아보세요.'));
    questions.forEach((question, index) => {
      const card = node('article', 'helper-card helper-card--saved');
      const input = node('textarea', 'helper-question-input'); input.value = question.text; input.maxLength = 240;
      input.setAttribute('aria-label', `담은 질문 ${index + 1} 수정`); input.rows = 2;
      input.addEventListener('input', () => { question.text = cleanQuestion(input.value) || question.text; });
      card.append(node('span', 'helper-card-label', `${String(index + 1).padStart(2, '0')} · 내 말로 수정할 수 있어요`), input,
        button('삭제', () => { questions.splice(index, 1); origins.delete(question); if (lastAdded === question) {lastAdded = null; undo.hidden = true;} render(); drawSuggestions(); })); saved.append(card);
    });
  }
  function add(value, origin = null) {
    const question = cleanQuestion(value);
    if (!question || questions.some(item => item.text === question) || (origin && [...origins.values()].includes(origin))) { status.textContent = '이미 담은 질문입니다.'; return false; }
    if (questions.length >= 12) { status.textContent = '질문은 최대 12개까지 담을 수 있어요.'; return false; }
    lastAdded = {text:question}; questions.push(lastAdded); if (origin) origins.set(lastAdded, origin);
    undo.hidden = false; render(); setStage(2); status.textContent = '진료 질문에 담았어요.';
    if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) saved.lastElementChild?.animate?.([{backgroundColor:'#dbe5ef'},{backgroundColor:'#ffffff'}], {duration:450});
    return true;
  }
  function setSuggestions(values, generated = false) {
    suggestionValues = [...new Set(values.map(cleanQuestion).filter(Boolean))].slice(0, 3);
    suggestionHeading.textContent = generated ? '방금 대화에서 나온 질문 · AI 추천' : '먼저 챙겨볼 질문 · AI 추천 아님';
    drawSuggestions();
  }
  function drawSuggestions() {
    const revision = ++suggestionRevision;
    suggestions.replaceChildren();
    const remaining = suggestionValues.filter(question => ![...origins.values()].includes(question));
    if (!remaining.length) suggestions.append(node('p', 'helper-empty', '준비한 질문을 모두 담았어요.'), button('내 질문 확인', () => {savedHeading.tabIndex = -1; savedHeading.focus?.();}));
    remaining.forEach((question, index) => {
      const card = node('article', 'helper-card helper-card--suggested');
      const text = node('p', '', question); let shortened = false;
      const shorten = button('더 짧게', () => { shortened = !shortened; text.textContent = shortened ? shortVisitQuestion(question) : question; shorten.textContent = shortened ? '원문으로' : '더 짧게'; note.hidden = !shortened; });
      shorten.disabled = shortVisitQuestion(question) === question;
      const note = node('small', 'helper-short-note', '프로젝트의 짧은 질문 예시입니다. 담은 뒤 직접 수정할 수 있어요.'); note.hidden = true;
      const take = button('+ 담기', async () => {
        if (take.disabled || !add(text.textContent, question)) return;
        take.disabled = true; shorten.disabled = true; take.textContent = '✓ 담았어요';
        if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches && card.animate) {
          const animation = card.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-8px)'}], {duration:220,fill:'forwards'});
          await animation.finished.catch(() => {});
        }
        if (revision !== suggestionRevision) return;
        drawSuggestions();
        (suggestions.querySelector?.('button') ?? undo).focus?.();
      });
      const actions = node('div', 'helper-card-actions'); actions.append(shorten, take);
      card.append(node('span', 'helper-card-index', String(index + 1).padStart(2, '0')), text, actions, note); suggestions.append(card);
    });
  }
  setSuggestions(QUESTION_TEMPLATES);
  const answers = node('div', 'helper-answers'); answers.setAttribute('aria-live', 'polite');
  const askForm = node('form', 'helper-add-form');
  const askInput = node('input', 'helper-manual-input'); askInput.maxLength = 600; askInput.required = true;
  askInput.placeholder = '예: AFP는 어떤 검사인가요?'; askInput.setAttribute('aria-label', '검사 설명 질문');
  const askButton = node('button', 'helper-button helper-button--primary', '질문 보내기 ↗'); askButton.type = 'submit';
  const askStatus = node('p', 'helper-note'); askStatus.setAttribute('role', 'status');
  let generation = 0; let controller;
  function newConversation() {
    generation++; controller?.abort(); askButton.disabled = false; askInput.value = '';
    answers.replaceChildren(); askStatus.textContent = '새 대화를 시작했어요. 담아둔 질문은 그대로예요.';
    introduction.hidden = false; setSuggestions(QUESTION_TEMPLATES);
    setStage(0); intentButtons.forEach(item => item.setAttribute('aria-pressed', 'false'));
  }
  askInput.addEventListener('input', () => { generation++; controller?.abort(); askButton.disabled = false; askStatus.textContent = ''; });
  askForm.append(askInput, askButton); chat.append(answers, askForm, askStatus);
  askForm.addEventListener('submit', async event => {
    event.preventDefault(); controller?.abort(); const activeController = controller = new AbortController();
    const sequence = ++generation;
    askButton.disabled = true; askStatus.textContent = '질문에 맞는 근거를 확인하고 있어요.';
    introduction.hidden = true; setStage(1);
    if (answers.childElementCount >= 20) answers.replaceChildren();
    answers.append(node('p', 'helper-user-message', askInput.value.trim()));
    setSuggestions(QUESTION_TEMPLATES);
    const deadline = setTimeout(() => activeController.abort(), 65000);
    try {
      if (!ask) throw new Error('HELPER_MODEL_NOT_CONFIGURED');
      const question = askInput.value.trim();
      const selected = selectedMetric()??getRecords?.().find(record => record.id === recordSelect.value);
      const topic = ['AFP','AST','ALT','GGT','LIVER'].includes(selected?.kind) ? selected.kind : null;
      // Only a topic label, never selected patient values/identifiers, accompanies a follow-up.
      const contextual = topic && !EXPLICIT_MEDICAL_TOPIC.test(question)
        && /이전|비교|준비|다음|기록|질문|이해|설명|확인|검사/u.test(question) ? `${topic}: ${question}` : question;
      const result = await ask(contextual, {signal:activeController.signal});
      if (sequence !== generation) return;
      answers.append(node('p', 'helper-answer', surface === 'mobile' && result.status === 'VISIT_PREPARATION'
        ? result.answer.replace('오른쪽에서', '아래 메모에서') : result.answer));
      const evidence = result.status === 'SYNTHETIC_SCENARIO' && result.synthetic === true
        && result.generationUsed === false && result.clinicalUse === false ? result.scenarioEvidence : null;
      if (evidence && typeof evidence.version === 'string' && evidence.version.length <= 80
        && evidence.diagnosisOrigin === 'PRESENTATION_SETUP'
        && typeof evidence.presentationId === 'string' && /^[A-Z0-9_-]{1,80}$/u.test(evidence.presentationId)
        && Array.isArray(evidence.records)
        && evidence.records.length > 0 && evidence.records.length <= 20
        && Array.isArray(evidence.recordIds) && evidence.recordIds.length === evidence.records.length) {
        const validRecords = evidence.records.every((record, index) => record
          && Object.hasOwn(SCENARIO_RECORD_LABELS, record.kind)
          && typeof record.id === 'string' && /^[A-Za-z0-9-]{1,80}$/u.test(record.id)
          && evidence.recordIds[index] === record.id
          && typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(record.date));
        if (validRecords) {
          const panel = node('details', 'helper-evidence-drawer helper-scenario-evidence');
          const summary = node('summary', '', `합성 기록 근거 · ${evidence.records.length}건`);
          panel.append(summary, node('p', 'helper-note', `자료 버전: ${evidence.version}`));
          const list = node('ul', 'helper-scenario-evidence-list');
          for (const record of evidence.records)
            list.append(node('li', 'helper-scenario-evidence-item', `${SCENARIO_RECORD_LABELS[record.kind]} · ${record.date} · 기록 ID ${record.id}`));
          panel.append(list, node('p', 'helper-note', `간암 전원 설정: ${evidence.presentationId} · PRESENTATION_SETUP. 검사·영상 기록에서 도출된 진단이 아닙니다.`));
          answers.append(panel);
        }
      }
      const claimEvidence = Array.isArray(result.claimEvidence)
        ? result.claimEvidence.filter(item => typeof item?.text === 'string' && typeof item?.quote === 'string') : [];
      if (claimEvidence.length) {
        const panel = node('details', 'helper-evidence-drawer helper-claim-evidence');
        panel.append(node('summary', '', '답변 발췌와 근거'));
        for (const item of claimEvidence) panel.append(
          node('p', 'helper-note', `답변 발췌: ${item.text}`),
          node('blockquote', 'helper-note', `근거 원문 발췌: ${item.quote}`));
        answers.append(panel);
      }
      for (const source of result.sources ?? []) {
        const url = helperSourceUrl(source.url); if (!url) continue;
        const card = node('article', 'helper-source-card');
        const link = node('a', 'helper-source', `${source.institution} · ${source.title}`);
        link.href = url;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link);
        if (typeof source.contextNote === 'string' && source.contextNote.trim())
          card.append(node('p', 'helper-note helper-source-context', source.contextNote.trim()));
        const drawer = node('details', 'helper-evidence-drawer');
        drawer.append(node('summary', '', '근거 서랍 · 위치와 이용조건'));
        drawer.append(node('p', 'helper-note', `확인할 위치: ${source.section ?? '원문'} · 자료 갱신: ${source.updatedAt ?? '미제공'}`));
        for (const context of Array.isArray(source.listContexts) ? source.listContexts : []) {
          if (typeof context?.heading !== 'string' || !Array.isArray(context.items)) continue;
          const items = context.items.filter(item => typeof item === 'string' && item.trim());
          if (!items.length) continue;
          const listSection = node('section', 'helper-source-list-context');
          listSection.setAttribute('aria-label', '원문 목록 안내와 항목');
          listSection.append(node('p', 'helper-note helper-source-list-label', '목록 안내'));
          listSection.append(node('p', 'helper-note helper-source-list-heading', context.heading));
          const list = node('ul', 'helper-source-list-items');
          for (const item of items) list.append(node('li', 'helper-source-list-item', item));
          listSection.append(list); drawer.append(listSection);
        }
        if (source.excerpt) drawer.append(node('p', 'helper-note', source.excerpt));
        drawer.append(node('p', 'helper-note', source.licenseLabel ?? '개별 원문 이용조건 확인'));
        const terms = node('a', 'helper-source-terms', '이용조건 확인');
        terms.href = helperSourceUrl(source.licenseUrl) ? source.licenseUrl : 'https://www.kogl.or.kr/info/licenseType4.do';
        terms.target = '_blank'; terms.rel = 'noopener noreferrer'; drawer.append(terms); card.append(drawer); answers.append(card);
      }
      if (result.status === 'GENERATED' || result.status === 'VISIT_PREPARATION') setSuggestions(result.questions, true);
      if (result.status === 'SOURCE_GUIDANCE') setSuggestions(result.questions ?? QUESTION_TEMPLATES, false);
      if (result.status === 'RETRIEVED') setSuggestions(result.questions ?? QUESTION_TEMPLATES, false);
      askStatus.textContent = result.status === 'VISIT_PREPARATION' ? '로컬 Qwen 질문 추천 · 공식 원문은 AI 입력으로 사용하지 않습니다 · 개인 기록 해석 아님.'
        : result.status === 'GENERATED' ? result.profile === 'SCHOOL_DEMO_TRANSLATION_RAG'
          ? '한국어 번역 근거 기반 AI 답변 · 학교 발표용 비임상 안내.' : '공개 근거 기반 설명 · 개인 기록 해석이 아닙니다.'
        : result.status === 'RETRIEVED' ? '한국어 번역 근거 검색 답변 · 학교 발표용 비임상 안내.'
        : result.status === 'SYNTHETIC_SCENARIO' ? '합성 발표 시나리오의 출처 설명 · AI 생성 및 임상 해석 아님.'
        : result.status === 'SOURCE_GUIDANCE' ? (result.profile === 'SCHOOL_DEMO_TRANSLATION_RAG' ? '관련 원문 자료 안내 · 학교 발표용 건강 정보' : '원문 링크 안내 · AI 생성 답변 아님 · 질문은 프로젝트 예시입니다.')
        : result.status === 'REFUSED' ? '진단·치료·약물이나 개별 운동 권고는 제공하지 않아요. 담당 의료진과 상담해 주세요.'
        : result.status === 'PERSONAL_INPUT_NOT_SUPPORTED' ? '개인 식별정보나 검사 수치는 입력할 수 없습니다. 일반 검사명으로 질문해 주세요.'
        : result.status === 'INSUFFICIENT_EVIDENCE' ? '질문에 답할 근거가 부족해요. 현재 지원하는 주제를 확인해 주세요.'
        : '현재 답변 가능한 범위를 확인해 주세요.';
    } catch (error) {
      if (sequence !== generation) return;
      askStatus.textContent = helperRequestErrorMessage(error);
    } finally { clearTimeout(deadline); if (sequence === generation) askButton.disabled = false; }
  });
  const form = node('form', 'helper-add-form');
  const input = node('input', 'helper-manual-input'); input.maxLength = 240; input.required = true;
  input.placeholder = '직접 질문을 적어보세요'; input.setAttribute('aria-label', '직접 추가할 진료 질문');
  const submit = node('button', 'helper-button helper-button--primary', '+ 직접 추가'); submit.type = 'submit';
  form.append(input, submit); form.addEventListener('submit', event => { event.preventDefault(); if (add(input.value)) input.value = ''; });
  const notesDialog = node('dialog', 'helper-notes-dialog');
  const notesList = node('ol', 'helper-notes-list');
  notesDialog.append(node('h2', '', '내 진료 질문'), notesList, button('닫기', () => notesDialog.close()));
  pocket.append(status, undo, form,
    button('질문 모아보기 ↗', () => { notesList.replaceChildren(); for (const question of questions) notesList.append(node('li', '', question.text)); if (!questions.length) notesList.append(node('li', '', '아직 담은 질문이 없어요.')); notesDialog.showModal(); }),
    node('p', 'helper-note', '이 페이지에서만 유지됩니다. 새로고침하면 삭제돼요.'));
  chat.append(jump, node('p', 'helper-disclaimer', '학교 발표용 건강 정보 안내와 진료 질문 준비를 돕습니다. 진단·처방은 제공하지 않습니다. 개인정보는 입력하지 마세요. 검사 주제와 한국어 설명 근거를 사용하며 개인 기록 수치·식별정보는 AI에 전달하지 않습니다.'));
  const workspace=node('div','helper-workspace');workspace.append(comparison,chat);
  grid.append(workspace, pocket); root.replaceChildren(header, context, grid, notesDialog); render(); refresh(); setStage(0);
  return {refresh,selectMetric(label){const metric=metrics.find(m=>m.title===label);if(!metric)return;recordSelect.value=metric.id;newConversation();drawComparison(true);}, reset() { generation++; controller?.abort(); askButton.disabled=false; askInput.value=''; introduction.hidden=false; notesDialog.close();
    notesList.replaceChildren(); input.value=''; status.textContent=''; origins.clear(); lastAdded=null; undo.hidden=true;
    answers.replaceChildren(); askStatus.textContent=''; questions.length=0;metrics=[];comparisonBody.replaceChildren();fromSelect.replaceChildren();toSelect.replaceChildren();recordSelect.replaceChildren(); render(); setSuggestions(QUESTION_TEMPLATES); setStage(0); intentButtons.forEach(item => item.setAttribute('aria-pressed', 'false')); }};
}
