// Local readiness hints only; the import endpoint remains authoritative.
export function importPreflight(consent, studyUid, hospitalId, now = Date.now()) {
  const checks = [
    ['환자 동의', Boolean(consent?.consentId && consent.status === 'ACTIVE'), '유효한 동의를 선택하세요.'],
    ['보관 권한', consent?.permission === 'DOWNLOAD_ALLOWED', '열람 전용 공유로는 보관할 수 없습니다.'],
    ['받는 병원', Boolean(hospitalId && consent?.targetHospitalId === hospitalId), '동의된 수신 병원과 현재 병원이 다릅니다.'],
    ['공유 기간', Boolean(consent && Date.parse(consent.validFrom) <= now && now < Date.parse(consent.validUntil)), '공유 기간을 확인하세요.'],
    ['검사 범위', Boolean(studyUid && consent?.scopes?.some(s => s.allowed !== false && s.studyInstanceUid === studyUid && s.seriesInstanceUid == null)), '전체 검사 보관을 허용한 범위가 필요합니다. Series 한정 공유는 이 도구에서 실행하지 않습니다.'],
  ];
  return { ready: checks.every(([, ok]) => ok), checks };
}
