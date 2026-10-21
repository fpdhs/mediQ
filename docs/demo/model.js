// Portfolio-only state machine. Not authentication, authorization or an audit backend.
export const studies = Object.freeze({
  ct: "복부 CT",
  checkup: "2026 건강검진",
});
export const reasons = Object.freeze({
  NO_CONSENT: [
    "먼저 공유 티켓을 만들어 주세요",
    "환자 역할에서 공유 조건을 선택한 뒤 티켓을 만들 수 있습니다.",
  ],
  CONSENT_REVOKED: [
    "환자가 공유를 중단했어요",
    "철회된 공유로는 새 열람권한을 받을 수 없습니다.",
  ],
  CONSENT_EXPIRED: [
    "공유 기간이 끝났어요",
    "단기 열람권한을 갱신해도 공유 기간을 연장할 수는 없습니다.",
  ],
  HOSPITAL_MISMATCH: [
    "공유받는 병원이 아니에요",
    "환자가 선택한 병원과 요청한 병원이 일치해야 합니다.",
  ],
  TICKET_ALREADY_USED: [
    "이미 접수한 QR 티켓이에요",
    "완료된 티켓을 재사용했습니다. 새 접수 없이 기존 접수 기록을 확인하세요.",
  ],
  RECEPTION_REQUIRED: [
    "QR 접수가 먼저 필요해요",
    "티켓으로 접수한 뒤 검사 범위와 열람 조건을 다시 확인합니다.",
  ],
  TOKEN_EXPIRED: [
    "단기 열람 시간이 끝났어요",
    "공유 동의가 유효하면 조건을 다시 확인하고 열람권한을 갱신할 수 있습니다.",
  ],
  SCOPE_MISMATCH: [
    "공유하지 않은 검사예요",
    "접수했다고 모든 기록이 공개되지는 않습니다. 환자가 고른 검사만 확인할 수 있습니다.",
  ],
  DOWNLOAD_NOT_ALLOWED: [
    "다운로드가 허용되지 않았어요",
    "이 체험판의 공유 권한은 열람 전용입니다.",
  ],
  DPOP_PROOF_REQUIRED: [
    "요청 서명 증명이 필요해요",
    "실제 시스템은 토큰과 함께 요청 서명도 확인합니다. 여기서는 증명 누락 상황만 재현합니다.",
  ],
});
export function createState() {
  return {
    consent: null,
    tokenUntil: 0,
    events: [],
    sequence: 0,
    questions: [],
  };
}
function log(s, action, result, code, now) {
  s.events.push({
    id: `EV-${String(++s.sequence).padStart(3, "0")}`,
    ticket: s.consent?.id ?? "—",
    at: now,
    action,
    result,
    code,
  });
}
export function consentProblem(s, now = Date.now(), hospital = "B병원") {
  if (!s.consent) return "NO_CONSENT";
  if (s.consent.status === "REVOKED") return "CONSENT_REVOKED";
  if (now >= s.consent.until) return "CONSENT_EXPIRED";
  if (hospital !== s.consent.hospital) return "HOSPITAL_MISMATCH";
  return null;
}
export function status(s, now = Date.now()) {
  if (!s.consent) return "아직 공유하지 않음";
  if (s.consent.status === "REVOKED") return "공유 중단";
  if (now >= s.consent.until) return "기간 종료";
  return s.consent.used ? "접수 완료" : "접수 대기";
}
export function act(s, type, input = {}, now = Date.now()) {
  let code = null;
  if (type === "create") {
    if (
      !Object.hasOwn(studies, input.study) ||
      !["B병원", "C병원"].includes(input.hospital) ||
      ![1, 3, 7].includes(input.days)
    )
      throw Error("INVALID_DEMO_SELECTION");
    if (s.consent && !consentProblem(s, now, s.consent.hospital))
      return { ok: false, code: "ACTIVE_TICKET_EXISTS" };
    s.consent = {
      id: `DEMO-${s.sequence + 1}`,
      study: input.study,
      hospital: input.hospital,
      days: input.days,
      purpose: "진료",
      permission: "VIEW_ONLY",
      since: now,
      until: now + input.days * 86400000,
      status: "ACTIVE",
      used: false,
    };
    s.tokenUntil = 0;
    log(s, "공유 동의 생성", "ALLOWED", "CONSENT_CREATED", now);
    log(s, "QR 티켓 발급", "ALLOWED", "TICKET_ISSUED", now);
  } else if (type === "revoke") {
    code = consentProblem(s, now, s.consent?.hospital);
    if (!code) {
      s.consent.status = "REVOKED";
      s.tokenUntil = 0;
      log(s, "공유 중단", "ALLOWED", "CONSENT_REVOKED", now);
      log(s, "QR 티켓 폐기", "ALLOWED", "TICKET_REVOKED", now);
    }
  } else if (type === "receive") {
    code = consentProblem(s, now, input.hospital ?? "B병원");
    if (!code && s.consent.used) code = "TICKET_ALREADY_USED";
    if (!code) {
      s.consent.used = true;
      log(s, "QR 접수", "ALLOWED", "TICKET_USED", now);
    }
  } else if (type === "renew" || type === "view" || type === "download") {
    code = consentProblem(s, now, input.hospital ?? "B병원");
    if (!code && !s.consent.used) code = "RECEPTION_REQUIRED";
    if (!code && input.study !== s.consent.study) code = "SCOPE_MISMATCH";
    if (!code && type === "download") code = "DOWNLOAD_NOT_ALLOWED";
    if (!code && type === "view" && now >= s.tokenUntil) code = "TOKEN_EXPIRED";
    if (!code) {
      if (type === "renew") s.tokenUntil = now + 300000;
      log(
        s,
        type === "renew" ? "단기 열람권한 발급" : "공유 검사 열람",
        "ALLOWED",
        type === "renew" ? "TOKEN_ISSUED" : "STUDY_VIEWED",
        now,
      );
    }
  } else if (type === "expireToken") {
    s.tokenUntil = 0;
    log(s, "단기권한 만료 상황 만들기", "INFO", "DEMO_TOKEN_EXPIRED", now);
  } else if (type === "expireConsent") {
    if (!s.consent) return { ok: false, code: "NO_CONSENT" };
    s.consent.until = now - 1;
    s.tokenUntil = 0;
    log(s, "공유기간 종료 상황 만들기", "INFO", "DEMO_CONSENT_EXPIRED", now);
  } else if (type === "proof") code = "DPOP_PROOF_REQUIRED";
  else throw Error("UNKNOWN_DEMO_ACTION");
  if (code) log(s, "요청 차단", "DENIED", code, now);
  return { ok: !code, code };
}
export function totals(events) {
  return {
    allowed: events.filter((e) => e.result === "ALLOWED").length,
    denied: events.filter((e) => e.result === "DENIED").length,
    info: events.filter((e) => e.result === "INFO").length,
  };
}
