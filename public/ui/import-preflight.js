// Local readiness hints only; the import endpoint remains authoritative.
export function importPreflight(consent, { studyInstanceUid, seriesInstanceUid, sopInstanceUid, hospitalId }, now = Date.now()) {
  const selectedScope = Array.isArray(consent?.scopes) && consent.scopes.some(scope => scope.allowed !== false
    && scope.studyInstanceUid === studyInstanceUid
    && (scope.seriesInstanceUid == null || scope.seriesInstanceUid === seriesInstanceUid));
  const validUid = value => typeof value === 'string' && value.length <= 64 && /^[0-9]+(?:\.[0-9]+)+$/u.test(value);
  const checks = [
    ['환자 동의', Boolean(consent?.consentId && consent.status === 'ACTIVE'), '유효한 동의를 선택하세요.'],
    ['보관 권한', consent?.permission === 'DOWNLOAD_ALLOWED', '열람 전용 공유로는 보관할 수 없습니다.'],
    ['받는 병원', Boolean(hospitalId && consent?.targetHospitalId === hospitalId), '동의된 수신 병원과 현재 병원이 다릅니다.'],
    ['공유 기간', Boolean(consent && Date.parse(consent.validFrom) <= now && now < Date.parse(consent.validUntil)), '공유 기간을 확인하세요.'],
    ['선택 영상 범위', Boolean(validUid(studyInstanceUid) && validUid(seriesInstanceUid) && validUid(sopInstanceUid) && selectedScope), '현재 선택된 영상이 동의 범위에 포함되어야 합니다.'],
  ];
  return { ready: checks.every(([, ok]) => ok), checks };
}
