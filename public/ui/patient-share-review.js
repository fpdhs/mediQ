import { patientPassState } from './patient.js';

export function shareReviewModel({ study, seriesUid = '', source, target, purpose, permission, from, until, patientName, consent, healthRecordIds=[] }) {
  const series = (study?.series ?? []).filter(row => !seriesUid || row.seriesInstanceUid === seriesUid);
  const start = new Date(from).getTime(), end = new Date(until).getTime();
  const valid = Boolean(study?.studyInstanceUid && study.sourceHospitalId === source && source !== target &&
    ['HOSP-A','HOSP-B','HOSP-C'].includes(target) && series.length &&
    ['TREATMENT','TRANSFER','CONSULTATION','RESEARCH'].includes(purpose) &&
    ['VIEW_ONLY','DOWNLOAD_ALLOWED'].includes(permission) && (!healthRecordIds.length||purpose!=='RESEARCH') && Number.isFinite(start) && Number.isFinite(end) && end > start && end > Date.now());
  const signature = JSON.stringify([patientName, study?.studyInstanceUid, seriesUid, source, target, purpose, permission, from, until, series.map(row => [row.seriesInstanceUid, row.instances?.length ?? row.instanceCount]),healthRecordIds]);
  return { valid, signature, series, count: series.reduce((sum,row) => sum + (row.instances?.length ?? row.instanceCount ?? 0),0), previous: patientPassState(consent).state };
}

export function createShareReview({root, read, onBack}) {
  if (!root) return {refresh(){}, allowed(){return false;}};
  const ack = root.querySelector('#share-review-ack'), button = root.querySelector('#patient-consent');
  let signature = '', busy = false;
  const put = (id,text) => { root.querySelector(id).textContent = text; };
  const hospital = id => ({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'가상 병원 C'}[id] ?? '병원 확인 필요');
  const refresh = (pending = busy) => {
    busy = pending;
    const input = read(), model = shareReviewModel(input);
    if (signature !== model.signature) { ack.checked = false; signature = model.signature; }
    put('#share-patient-name', input.patientName || '환자');
    const description = input.study?.description;
    put('#share-exam-title', input.study?.modality === 'CT' && description?.startsWith('합성 복부 CT 시연 영상') ? '복부 CT' : description || '검사를 선택해 주세요');
    put('#share-exam-meta', `${hospital(input.source)} · ${input.study?.studyDate || '검사일 확인 필요'}`);
    put('#share-exam-count', `선택한 시리즈 ${model.series.length}개${model.count ? ` · 영상 ${model.count}장` : ' · 영상 수 확인 필요'}`);
    put('#share-hospital', hospital(input.target));
    put('#share-purpose', `목적 · ${{TREATMENT:'진료',TRANSFER:'전원',CONSULTATION:'협진',RESEARCH:'연구'}[input.purpose] || '확인 필요'}`);
    put('#share-allow-download', input.permission === 'DOWNLOAD_ALLOWED' ? '선택 범위의 다운로드 허용' : '영상 열람만 허용 · 다운로드 제외');
    const healthSummary=root.querySelector('#share-health-summary');
    if(healthSummary)healthSummary.textContent=input.healthRecordTitles?.length?`함께 전달하는 건강기록: ${input.healthRecordTitles.join(', ')}`:'함께 전달하는 건강기록 없음';
    put('#share-deny-download', input.permission === 'DOWNLOAD_ALLOWED' ? '허용 범위 밖 다운로드' : '영상 다운로드 및 저장');
    const format = value => Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('ko-KR') : '기간을 설정해 주세요';
    put('#share-period-value', `${format(input.from)} ~ ${format(input.until)}`);
    const notice = root.querySelector('#share-previous-notice');
    notice.hidden = !['REVOKED','EXPIRED'].includes(model.previous);
    notice.textContent = '이전 공유는 종료됐어요. 다시 공유하려면 새로운 승인이 필요해요.';
    ack.disabled = busy; button.disabled = busy || !ack.checked || !model.valid;
    root.querySelectorAll('#share-health-picker input').forEach(input=>{input.disabled=busy;});
    put('#share-review-status', !model.valid ? '검사·병원·권한·유효기간을 확인해 주세요.' : busy ? '서버에서 공유 승인 결과를 확인하고 있어요.' : '승인 후 서버 확인을 거쳐 QR가 발급됩니다.');
    return model;
  };
  root.addEventListener('change', () => refresh());
  root.addEventListener('input', event => { if(event.target !== ack) {ack.checked = false; refresh();} });
  root.querySelectorAll('[data-route="home"]').forEach(node => node.addEventListener('click', onBack));
  return {refresh, allowed(){const model=refresh(); return !busy && ack.checked && model.valid;}};
}
