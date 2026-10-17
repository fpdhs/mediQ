export function vaultItem(archive) {
  const state = archive.retention?.state;
  const known = archive.retention?.policy === 'CONSENT_BOUND_V1';
  const group = !known ? 'review' : state === 'DELETED' ? 'ended' : ['DELETE_PENDING','DELETE_FAILED'].includes(state) ? 'deleting' : state === 'STORED' ? 'stored' : 'review';
  const label = !known ? '보관정책 확인 필요' : ({STORED:archive.access?.allowed === true ? '암호화 보관 중' : '접근 차단 · 상태 확인 필요',DELETE_PENDING:'접근 차단 · 삭제 중',DELETE_FAILED:'접근 차단 · 삭제 재시도 필요',DELETED:'삭제 완료'})[state] || '상태 확인 필요';
  return { group, label, deadline:known && Number.isFinite(Date.parse(archive.retention.validUntil)) ? new Date(archive.retention.validUntil).toLocaleString('ko-KR') : '기한 미확인' };
}

export function renderHospitalVault(root, {archives=[],studies=[],state='ready'}={}) {
  if (!root) return;
  root._vaultData = {archives,studies,state};
  const selected = root.dataset.filter || 'all';
  const output = root.querySelector('[data-vault-items]');
  const status = root.querySelector('[data-vault-status]');
  root.querySelectorAll('[data-vault-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.vaultFilter===selected)));
  output.replaceChildren();
  if (state !== 'ready') { status.textContent = state === 'loading' ? '보관 목록을 확인하고 있어요.' : '보관 목록을 확인하지 못했습니다. 다시 확인해 주세요.'; return; }
  const visible = archives.filter(a=>selected==='all'||vaultItem(a).group===selected);
  status.textContent = visible.length ? `${visible.length}건 · 서버가 제공한 로컬 보관 기록` : '이 분류에 해당하는 보관 기록이 없습니다.';
  for (const archive of visible) {
    const model = vaultItem(archive), row = document.createElement('li'); row.dataset.group = model.group;
    const icon=document.createElement('span');icon.className='vault-file-icon';icon.textContent='▤';icon.setAttribute('aria-hidden','true');
    const title=document.createElement('div');
    const name=document.createElement('strong');name.textContent=studies.find(s=>s.studyInstanceUid===archive.studyInstanceUid)?.description || 'DICOM 검사';
    const description=document.createElement('small');description.textContent=`${archive.sourceHospitalId || '출처 미확인'} · ${archive.patientId || '환자 식별자 미확인'}`;title.append(name,description);
    const deadline=document.createElement('div');const caption=document.createElement('small');caption.textContent='보관 종료';const date=document.createElement('span');date.textContent=model.deadline;deadline.append(caption,date);
    const label=document.createElement('span');label.className='vault-state';label.textContent=model.label;
    row.append(icon,title,deadline,label);output.append(row);
  }
  if (!root.dataset.bound) {
    root.dataset.bound='true';
    root.addEventListener('click',event=>{
      const button=event.target.closest('[data-vault-filter]');if(!button)return;
      root.dataset.filter=button.dataset.vaultFilter;renderHospitalVault(root,root._vaultData);
    });
  }
}
