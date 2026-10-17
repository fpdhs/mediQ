// Read-only presentation: archive inventory is not a transfer receipt.
export function transferTrackingModel({ consent, study, archives = [], state = 'ready' } = {}) {
  const viewOnly = consent?.permission === 'VIEW_ONLY';
  return {
    source: consent?.sourceHospitalId || '제공 병원 미확인',
    target: consent?.targetHospitalId || '받는 병원 미확인',
    study: study?.description || '진료 준비에서 검사를 선택하세요',
    title: state === 'loading' ? '보관 기록을 확인하고 있어요.' : state === 'error'
      ? '지금은 전송 상태를 확인할 수 없어요.' : viewOnly
        ? '열람 공유는 PACS 반입과 달라요.' : '영상이 어디까지 왔는지 확인하세요.',
    note: state === 'error' ? '조회 실패는 접근 거부나 전송 실패를 뜻하지 않습니다. 다시 확인해 주세요.'
      : viewOnly ? '현재 선택한 공유는 영상 열람만 허용합니다. 병원에 파일을 저장하는 반입 작업은 제공하지 않습니다.'
        : '현재 API는 로컬 보관 시뮬레이터 목록만 제공합니다. 이 목록만으로 실제 전송·수신 검증·PACS 등록을 확인할 수 없습니다.',
    count: state === 'ready' ? String(archives.length) : '—',
    allowTool: state === 'ready' && consent?.permission === 'DOWNLOAD_ALLOWED' && consent?.status === 'ACTIVE',
    steps: [
      ['공유 조건', consent ? `${consent.status} · ${viewOnly ? '열람 전용' : consent.permission === 'DOWNLOAD_ALLOWED' ? '다운로드 허용' : '권한 미확인'}` : '선택한 동의 없음'],
      ['영상 전송', viewOnly ? '반입 대상 아님' : '전송 증적 미확인'],
      ['수신 검증', viewOnly ? '반입 대상 아님' : '수신 증적 미확인'],
      ['PACS 등록', viewOnly ? '반입 대상 아님' : 'NOT VERIFIED'],
    ],
  };
}

export function renderTransferTracking(root, input) {
  if (!root) return;
  const model = transferTrackingModel(input);
  for (const field of ['source', 'target', 'study', 'title', 'note', 'count']) {
    root.querySelector(`[data-track="${field}"]`).textContent = model[field];
  }
  root.querySelector('[data-track-tool]').hidden = !model.allowTool;
  const steps = root.querySelector('[data-track-steps]');
  steps.replaceChildren(...model.steps.map(([title, status], index) => {
    const item = document.createElement('li');
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('strong'); label.textContent = title;
    const detail = document.createElement('small'); detail.textContent = status;
    item.append(number, label, detail); return item;
  }));
}
