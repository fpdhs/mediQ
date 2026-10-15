/* ==========================================================================
   HiPass Platform — Unified Frontend Controller
   - Persona Router: Patient Experience Portal vs. Hospital SaaS Console
   - Dynamic ABAC Policy Engine & DICOMweb Token Management
   - FHIR R4 PHR, 5-Step Pipeline, Cloud Viewer, PACS Import & Live Receipts
   ========================================================================== */
import { initializeCapstoneAuth } from "/capstone-auth.js";
import {initializeDemoTools,demoEnvironment} from '/ui/demo-tools.js';
let demoTools=null;
import {openPatientPixelViewer, createPatientPixelSession} from '/patient-pixel-viewer.js';
import {createPatientLibrary} from '/ui/patient-library.js';
import {createPatientSharing,createSharingSurface, recipientChoices, sharingDraftModel} from '/ui/patient-sharing.js';
import {createPatientHistory} from '/ui/patient-history.js';
import {createPatientHealth, healthRecords} from '/ui/patient-health.js';
import {createPatientHelper} from '/ui/patient-helper.js';
import {createHealthRecordClient} from '/ui/health-record-client.js';
import {createScenarioHealthStandard} from '/ui/scenario-health-standard.js';
let scenarioHealthStandard=null;
import {createHealthSharePicker} from '/ui/health-share-picker.js';
import {createClinicianHealth} from '/ui/clinician-health.js';
import {renderTransferTracking} from '/ui/transfer-tracking.js';
import {importPreflight} from '/ui/import-preflight.js';
import {renderHospitalVault} from '/ui/hospital-vault.js';
import {renderSecurityTimeline} from '/ui/security-timeline.js';
import {renderSecurityConsole} from '/ui/security-console.js';
import { loginHomePath } from '/login-navigation.js';
let auditTimelineVersion=0;
let pacsImportBusy = false;
let transferQueue = [];
let transferQueueConsentId = "";
let activeTransferJobId = "";
let activeTransferJobs = [];
let healthSharePicker=null, clinicianHealth=null;
import {createWalletHome,createHelperSurface,mountPatientWalletDock} from '/ui/wallet-home.js';
import {createQrTicketSurface} from '/ui/patient-qr-ticket.js';
let walletHome=null;
let walletSnapshotReady=false;
function refreshWalletHome(){walletHome?.update({name:demo.patientName,records:healthRecords(lastStudies,Boolean(capstoneAuth?.context.scenario),syntheticHealthClient?.records()||[]),consents:lastConsents,ready:walletSnapshotReady});}
let patientHealth = null;
let patientHelper = null;
let syntheticHealthClient=null;
let patientSharing = null;
let patientHistory = null;
let patientLibrary = null;
import {createFaqAssistant} from '/ui/faq-assistant.js';
let faqAssistant=null;
import { initializePatientComponents, renderPatientOverview, renderPresentationScenario, createPatientQrController, renderPatientQr } from "/ui/patient.js";
import { selectConsentForStudy, isRevocationAcknowledged } from "/consent-selection.js";
import { createShareReview } from '/ui/patient-share-review.js';
let shareReview = null;
let patientStudySnapshotAvailable = false;
import { clinicalNextAction, renderClinicalActivity, renderClinicalDossier, renderClinicianDetail, clinicianDetailModel, filterClinicalStudies, renderClinicalMetrics, renderClinicalStudyList } from "/ui/clinician.js";
import { initializeViewerStudio } from '/ui/viewer-studio.js';
import { initializeTransferActions } from '/ui/transfer-actions.js';
import { createClinicianHome } from '/ui/clinician-home.js';
import { initializeReceptionHome } from '/ui/clinician-reception.js';
import {createReceptionDesk} from '/ui/clinician-reception-desk.js';
let receptionDesk=null;
let receptionHome=null;
let clinicianHome = null;
const capstoneAuth = await initializeCapstoneAuth();
const patientQrController = createQrTicketSurface({
  root:document.querySelector('#patient-portal-app [data-page="visit"]'),
  read:()=>({consents:lastConsents,studies:lastStudies,ready:walletSnapshotReady}),
  issue:id=>postJson(`/api/consents/${encodeURIComponent(id)}/handoff-ticket`,{replaceExisting:true}),
  navigate:route=>navigatePatientPage(route==='history'?'activity':route),
  readStatus: (consentId, ticketId) => fetchJson(`/api/consents/${encodeURIComponent(consentId)}/handoff-tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) }),
  render: renderPatientQr,
});
window.addEventListener("pagehide", () => patientQrController.clear());
window.addEventListener('pagehide', () => patientLibrary?.setActive(false));
window.addEventListener('pagehide', () => patientHealth?.setActive(false));
window.addEventListener('pagehide', () => scenarioHealthStandard?.reset());

const demo = {
  patientId: capstoneAuth?.context.patientId ?? "P-1001",
  patientName: capstoneAuth?.context.patientName ?? "합성 시연 환자",
  doctorId: "DOC-B-01",
  sourceHospitalId: "HOSP-A",
  targetHospitalId: "HOSP-B",
  purpose: "TREATMENT",
  permission: "VIEW_ONLY",
  studyInstanceUid: capstoneAuth?.context.defaultStudyUid ?? "1.2.410.100.1.20260620.001",
};
if (capstoneAuth?.context) {
  const profileName = document.querySelector('#patient-portal-app .profile-copy strong');
  const avatar = document.querySelector('#patient-portal-app .profile .avatar');
  if (profileName) profileName.textContent = capstoneAuth.context.scenario ? `${demo.patientName} · 56세` : `${demo.patientName} (${demo.patientId})`;
  if (avatar) avatar.textContent = capstoneAuth.context.scenario ? '홍' : demo.patientId === 'HP-TEST-PHANTOM-001' ? 'TEST' : '1001';
  if (capstoneAuth.context.scenario) {
    const homeTitle = document.querySelector('#patient-portal-app [data-page="home"] h1');
    if (homeTitle) homeTitle.textContent = `${demo.patientName}님,\n다음 진료에 가져갈 영상이 준비됐어요.`;
    for (const node of document.querySelectorAll('[data-scenario-patient]')) node.textContent = '홍길동 · 56세 · 합성 환자';
  }
}

const adminHospitals = [
  { hospitalId: "HOSP-A", name: "가상 병원 A (Virtual Hospital A)", status: "ACTIVE" },
  { hospitalId: "HOSP-B", name: "가상 병원 B (Virtual Hospital B)", status: "ACTIVE" },
  { hospitalId: "HOSP-C", name: "가상 병원 C (Virtual Hospital C)", status: "ACTIVE" },
];

const adminGateways = [
  { gatewayId: "GW-HOSP-A", hospitalId: "HOSP-A", endpoint: "/dicomweb", status: "ONLINE" },
  { gatewayId: "GW-HOSP-B", hospitalId: "HOSP-B", endpoint: "/dicomweb", status: "ONLINE" },
  { gatewayId: "GW-HOSP-C", hospitalId: "HOSP-C", endpoint: "/dicomweb", status: "ONLINE" },
];

const wwWlPresets = [
  { name: "기본", contrast: 1, brightness: 1 },
  { name: "폐 (Lung)", contrast: 1.6, brightness: 0.9 },
  { name: "골격 (Bone)", contrast: 2.0, brightness: 1.1 },
  { name: "뇌연부 (Brain)", contrast: 1.3, brightness: 1.05 },
];

const zoomScales = [1, 1.5, 2];

// Runtime State Variables (strictly in-memory only)
let currentPersona = "PATIENT";
let latestConsentId = "CONSENT-DEMO-ACTIVE";
let latestTicketNonce = null;
let latestToken = null;
let latestTokenInfo = null;
let countdownTimerId = null;
let selectedStudyUid = demo.studyInstanceUid;
let selectedSeriesUid = "";
let selectedSopUid = "";
let selectedStudy = null;
let lastStudies = [];
let lastConsents = [];
let lastSeries = [];
let lastInstances = [];
let patientConsentReady = false;
let consentViewRevision = 0;
let consentMutationPending = false;
let tokenRequestPending = false;
let dashboardRequestSequence = 0;
let dashboardAppliedSequence = 0;
let dashboardLoadsInFlight = 0;
let clinicalRecentLogs = [];
let isEasyMode = false;
let isPreflightPassed = false;
let preflightFingerprint = "";
let wwWlPresetIndex = 0;
let zoomScaleIndex = 0;
let isInverted = false;
let isSideBySideActive = false;
let currentSliceIndex = 0;
let totalSlices = 1;
let isCinePlaying = false;
let cineFps = 15;
let cineIntervalId = null;
const sliceBlobCache = new Map();

// DOM Selectors
const output = document.querySelector("#output");
const patientStatus = document.querySelector("#patient-status");
const viewerStatus = document.querySelector("#viewer-status");
const viewerImage = document.querySelector("#viewer-image");
const viewerPlaceholder = document.querySelector("#viewer-placeholder");
const viewerAlert = document.querySelector("#viewer-alert");
const instanceDetail = document.querySelector("#instance-detail");
const sourceHospitalSelect = document.querySelector("#source-hospital-select");
const targetHospitalSelect = document.querySelector("#target-hospital-select");
const patientStudySelect = document.querySelector("#patient-study-select");
const patientSeriesSelect = document.querySelector("#patient-series-select");
const accessPurposeSelect = document.querySelector("#access-purpose-select");
const accessModeSelect = document.querySelector("#access-mode-select");
const consentValidFromInput = document.querySelector("#consent-valid-from");
const consentValidUntilInput = document.querySelector("#consent-valid-until");
const downloadButton = document.querySelector("#download-instance");
const auditResultFilter = document.querySelector("#audit-result-filter");
const auditActionFilter = document.querySelector("#audit-action-filter");
const phrLoadState = document.querySelector("#phr-load-state");
const phrImagingList = document.querySelector("#phr-imaging-list");
const phrHandoffLink = document.querySelector("#phr-handoff-link");
const pendingPhrHandoffNonce = capturePhrHandoffNonce();

// Cross-window Real-time Sync & Toast Notification
let toastTimer = null;
function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function pulseHighlightElement(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("highlight-pulse");
  void el.offsetWidth;
  el.classList.add("highlight-pulse");
  setTimeout(() => el.classList.remove("highlight-pulse"), 2500);
}

let hipassSyncChannel = null;
let hipassMobileChannel = null;

function handleIncomingSyncMessage(data) {
  if (!data) return;
  const action = data.action || (data.type === "SYNC" ? data.action : null);

  if (action === "TICKET_ISSUED") {
    if (data.nonce) {
      latestTicketNonce = data.nonce;
    }
    if (data.consentId) {
      latestConsentId = data.consentId;
      patientConsentReady = true;
    }
    const statusPill = document.querySelector("#qr-handoff-status");
    const scannedRef = document.querySelector("#qr-scanned-ref");
    const message = document.querySelector("#qr-handoff-message");

    if (statusPill) {
      statusPill.textContent = "모바일 QR 수신 대기 (READY)";
      statusPill.className = "mq-badge mq-badge-warn";
    }
    if (scannedRef && data.ticketId) {
      scannedRef.textContent = `${data.ticketId} (모바일 1회용)`;
    }
    if (message) {
      message.textContent = "모바일 QR 알림을 받았습니다. 접수 전에 서버에서 환자·동의·티켓을 확인합니다.";
      message.dataset.tone = "info";
    }
    showToast("📱 환자 모바일 앱에서 새 1회용 QR 접수 티켓이 발행되었습니다.");
    loadDashboard({ skipPhr: true }).catch(() => {});
  } else if (action === "CONSENT_REVOKED") {
    latestTicketNonce = null;
    const statusPill = document.querySelector("#qr-handoff-status");
    const message = document.querySelector("#qr-handoff-message");
    if (statusPill) {
      statusPill.textContent = "동의 철회됨 (REVOKED)";
      statusPill.className = "mq-badge mq-badge-bad";
    }
    if (message) {
      message.textContent = "환자가 모바일에서 영상 공유 동의를 철회하였습니다. 접근 권한이 즉시 차단되었습니다.";
      message.dataset.tone = "fail";
    }
    showToast("⚠️ 환자가 모바일에서 영상 공유 동의를 철회했습니다.");
    loadDashboard({ skipPhr: true }).catch(() => {});
  } else {
    loadDashboard({ skipPhr: true }).catch(() => {});
  }
}

try {
  if (typeof BroadcastChannel !== "undefined") {
    hipassSyncChannel = new BroadcastChannel("hipass_sync");
    hipassSyncChannel.onmessage = (event) => {
      handleIncomingSyncMessage(event.data);
    };
    hipassMobileChannel = new BroadcastChannel("HI_PASS_SYNC_CHANNEL");
    hipassMobileChannel.onmessage = (event) => {
      handleIncomingSyncMessage(event.data);
    };
  }
} catch {
  // BroadcastChannel unavailable or restricted
}

function broadcastSync(action) {
  try {
    if (hipassSyncChannel) {
      hipassSyncChannel.postMessage({ type: "SYNC", action, timestamp: Date.now() });
    }
  } catch {
    // Ignore error
  }
  try {
    if (hipassMobileChannel) {
      hipassMobileChannel.postMessage({ action, timestamp: Date.now() });
    }
  } catch {
    // Ignore error
  }
}

// Background Heartbeat Polling (every 2.5s for seamless multi-tab or multi-window live sync)
setInterval(() => {
  loadDashboard({ skipPhr: true, background: true }).catch(() => {});
}, 2500);

// --------------------------------------------------------------------------
// Navigation & Persona Routing
// --------------------------------------------------------------------------
function initNavigation() {
  // Top Global Persona Switcher Tabs
  document.querySelectorAll("[data-persona]").forEach((button) => {
    button.addEventListener("click", () => switchPersona(button.dataset.persona));
  });

  // Patient Portal Sub-routing
  document.querySelectorAll("#patient-portal-app [data-route]").forEach((button) => {
    button.addEventListener("click", () => navigatePatientPage(button.dataset.route));
  });

  // Contract Marker Support: data-view-target="patient-phr"
  document.querySelectorAll('[data-view-target="patient-phr"]').forEach((button) => {
    button.addEventListener("click", () => navigatePatientPage("phr"));
  });

  // Hospital SaaS Sub-routing
  document.querySelectorAll("#hospital-saas-app [data-view]").forEach((button) => {
    button.addEventListener("click", () => navigateHospitalScreen(button.dataset.view==='viewer'?'studies':button.dataset.view));
  });
  document.querySelectorAll("#hospital-saas-app [data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => navigateHospitalScreen(button.dataset.viewJump));
  });

  // Hash-based initial persona determination
  const initialHash = (location.hash || "").replace("#", "");
  if (capstoneAuth?.roles?.length === 1 && capstoneAuth.roles[0] === 'PATIENT') {
    switchPersona('PATIENT');
  } else if (capstoneAuth?.roles?.length === 1 && capstoneAuth.roles[0] === 'SECURITY_ADMIN') {
    switchPersona('DOCTOR', false);
    navigateHospitalScreen('audit');
  } else if (capstoneAuth?.context.entryRole === 'DOCTOR' || ["DOCTOR", "doctor", "HOSPITAL_ADMIN", "admin"].includes(initialHash)) {
    switchPersona("DOCTOR", false);
    navigateHospitalScreen("dashboard");
  } else {
    switchPersona("PATIENT", false);
    if (initialHash && !["PATIENT", "patient"].includes(initialHash)) {
      navigatePatientPage(initialHash);
    }
  }
}

function switchPersona(persona, updateHash = true) {
  const securityAdminShell = persona === 'DOCTOR' && capstoneAuth?.roles?.includes('SECURITY_ADMIN');
  if (capstoneAuth?.roles && !capstoneAuth.roles.includes(persona) && !securityAdminShell) {
    showToast(`현재 계정에는 ${persona==='PATIENT'?'환자':'의료진'} 권한이 없습니다. 해당 역할의 계정으로 인증해 주세요.`);
    return;
  }
  faqAssistant?.reset();
  demoTools?.close();
  ++auditTimelineVersion;
  renderSecurityTimeline(document.querySelector('#security-timeline'),null,'error');
  patientHelper?.reset();
  syntheticHealthClient?.reset();
  scenarioHealthStandard?.reset();
  healthSharePicker?.reset();
  clinicianHealth?.reset();
  clinicianHome?.reset();
  receptionDesk?.clear();
  receptionHome?.reset();
  const receptionContext=document.querySelector('#reception-context');
  if(receptionContext){receptionContext.hidden=true;receptionContext.textContent='';}
  walletHome?.reset();
  walletSnapshotReady=false;
  patientLibrary?.setActive(false);
  patientHealth?.setActive(false);
  currentPersona = persona;
  document.querySelector('.hp-skip')?.setAttribute('href', persona === 'PATIENT' ? '#patient-main' : '#clinician-main');
  document.querySelectorAll("[data-persona]").forEach((btn) => {
    const isTarget = btn.dataset.persona === persona;
    btn.classList.toggle("active", isTarget);
    btn.setAttribute("aria-selected", String(isTarget));
  });

  const patientApp = document.querySelector("#patient-portal-app");
  const hospitalApp = document.querySelector("#hospital-saas-app");
  hospitalApp?.classList.toggle('security-admin-only', Boolean(securityAdminShell));
  if (securityAdminShell) {
    hospitalApp.setAttribute('aria-label', 'Medi Q 보안 관제실');
    const brandSub = hospitalApp.querySelector('.mq-brand-sub');
    if (brandSub) brandSub.textContent = 'Security Operations';
    const context = hospitalApp.querySelector('.mq-context');
    if (context) {
      context.setAttribute('aria-label', '보안 운영자 컨텍스트');
      if (!context.querySelector('[data-security-session]')) {
        const badge = document.createElement('span');
        badge.dataset.securitySession = 'true';
        badge.className = 'security-session-badge';
        badge.textContent = '보안 운영자 · 인증됨';
        const logout = document.createElement('button');
        logout.type = 'button'; logout.className = 'mq-btn'; logout.textContent = '로그아웃';
        logout.addEventListener('click', () => location.replace(loginHomePath(location.pathname)));
        context.append(badge, logout);
      }
    }
  }

  if (persona === "PATIENT") {
    if (patientApp) patientApp.hidden = false;
    if (hospitalApp) hospitalApp.hidden = true;
    if (updateHash) history.replaceState(null, "", "#PATIENT");
  } else {
    if (patientApp) patientApp.hidden = true;
    if (hospitalApp) hospitalApp.hidden = false;
    if (updateHash) history.replaceState(null, "", "#DOCTOR");
  }
  demoTools?.update();
}

// Backwards-compatible Role activation helper
function activateRole(role, updateHash = true) {
  if (role === "DOCTOR" || role === "HOSPITAL_ADMIN" || role === "SECURITY_ADMIN" || role === "PLATFORM_ADMIN") {
    switchPersona("DOCTOR", updateHash);
  } else {
    switchPersona("PATIENT", updateHash);
  }
}

function navigatePatientPage(page) {
  if(page==='visit')patientQrController.refresh();
  if (page === 'helper') {patientHelper?.refresh();void syntheticHealthClient?.load();}
  if (page === 'phr') void syntheticHealthClient?.load();
  if (page === 'consent') void syntheticHealthClient?.load();
  if (page === 'consent') shareReview?.refresh();
  const patientApp = document.querySelector("#patient-portal-app");
  if (!patientApp) return;

  const pageTitles = {
    home: "행동센터",
    timeline: "건강 타임라인",
    images: "내 의료영상",
    phr: "내 건강기록",
    helper: "건강도우미",
    consent: "공유 동의 관리",
    sharing: "동의·공유",
    health: "건강검진·검사결과 데모",
    visit: "공유 QR",
    activity: "접근이력·동의 영수증",
    notifications: "알림",
    storage: "저장공간·만료",
    recovery: "오류 복구",
    documents: "판독문·의뢰서",
    delegation: "보호자·가족 위임",
  };

  patientApp.querySelectorAll("[data-page]").forEach((p) => {
    p.hidden = p.dataset.page !== page;
  });
  patientLibrary?.setActive(page === 'images');
  patientHealth?.setActive(page === 'phr');
  mountPatientWalletDock(patientApp.querySelector(`[data-page="${page}"]`),page,navigateFromPatientWallet);
  patientApp.querySelectorAll("[data-route]").forEach((b) => {
    const active = b.dataset.route === page || (['consent','activity','visit'].includes(page) && b.dataset.route === 'sharing') || (page==='images' && b.dataset.route==='phr');
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });

  const contextTitle = document.querySelector("#contextTitle");
  if (contextTitle && pageTitles[page]) {
    contextTitle.textContent = pageTitles[page];
  }
}

function navigateFromPatientWallet(page) {
  navigatePatientPage(page);
  const destination=document.querySelector(`#patient-portal-app [data-page="${page}"]`);
  const heading=destination?.querySelector('h1');
  heading?.setAttribute('tabindex','-1');
  heading?.focus({preventScroll:true});
  destination?.scrollIntoView({block:'start',behavior:'instant'});
}

function navigateHospitalScreen(screen) {
  if (typeof capstoneAuth !== 'undefined' && capstoneAuth?.roles?.length === 1 && capstoneAuth.roles[0] === 'SECURITY_ADMIN' && screen !== 'audit') return;
  const hospitalApp = document.querySelector("#hospital-saas-app");
  if (!hospitalApp) return;
  if (screen !== "viewer") {
    stopCinePlayback();
  }
  if (screen !== 'dashboard') stopCameraQrScan();

  const screenMeta = {
    dashboard: ["의료진 / 홈", "홈"],
    exchange: ["시연도구 / 영상 보안 여정", "영상 보안 여정"],
    studies: ["의료진 / 검사 선택", "승인된 의료영상"],
    records: ["의료진 / 환자 기록", "환자 기록"],
    viewer: ["의료진 / 환자 영상", "환자 영상"],
    transfer: ["의료진 / 병원 보관함", "병원 보관함"],
    audit: ["보안 관리자 / 관제", "보안 관제실"],
    qr: ["의료진 / 접수 데스크", "접수 데스크"],
    admin: ["운영 / 플랫폼·보안 관리", "플랫폼·보안 관리"],
    "pacs-archive": ["시연도구 / 전송 확인", "병원 간 영상 전달 상태"],
  };

  hospitalApp.querySelectorAll(".mq-screen").forEach((s) => {
    s.hidden = s.dataset.screen !== screen;
  });
  hospitalApp.dataset.uiTheme = screen === 'viewer' ? 'diagnostic-dark' : 'clinical-white';
  hospitalApp.classList.toggle('mq-focus-viewer', screen === 'viewer');
  const shell = hospitalApp.querySelector('.mq-viewer-shell');
  const previewHost = document.querySelector('#clinical-preview-host');
  const viewerScreen = hospitalApp.querySelector('[data-screen="viewer"]');
  if (shell && previewHost && viewerScreen) {
    (screen === 'viewer' ? viewerScreen : previewHost).append(shell);
  }
  hospitalApp.querySelectorAll(".mq-nav").forEach((b) => {
    const selected = b.dataset.view === (screen === 'studies' ? 'viewer' : screen);
    b.classList.toggle("active", selected);
    b.setAttribute("aria-selected", String(selected));
    if (selected) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  const breadcrumb = document.querySelector("#mq-breadcrumb");
  const title = document.querySelector("#mq-header-title");
  if (breadcrumb && screenMeta[screen]) breadcrumb.textContent = screenMeta[screen][0];
  if (title && screenMeta[screen]) title.textContent = screenMeta[screen][1];

  if (screen === "pacs-archive") {
    loadHospitalBPacsArchive();
    void restorePacsTransferJob();
  }
  if (screen === 'transfer') { runPreflightCheck(); loadHospitalBPacsArchive(); void restorePacsTransferJob(); }
  if (screen === 'audit') loadAuditTimeline();
  clinicianHealth?.setActive(screen==='records'&&currentPersona==='DOCTOR');
  if(screen==='qr'&&currentPersona==='DOCTOR')receptionDesk?.load();
}

// Backwards-compatible View activation helper
function activateView(targetId) {
  if (targetId === "patient-phr" || targetId === "phr") {
    switchPersona("PATIENT");
    navigatePatientPage("phr");
  } else if (targetId === "patient-studies" || targetId === "images") {
    switchPersona("PATIENT");
    navigatePatientPage("images");
  } else if (targetId === "patient-receipts" || targetId === "activity") {
    switchPersona("PATIENT");
    navigatePatientPage("activity");
  } else if (targetId === "patient-visit" || targetId === "visit") {
    switchPersona("PATIENT");
    navigatePatientPage("visit");
  } else if (targetId === "doctor-viewer" || targetId === "viewer") {
    switchPersona("DOCTOR");
    navigateHospitalScreen("viewer");
  } else if (targetId === "doctor-studies" || targetId === "studies") {
    switchPersona("DOCTOR");
    navigateHospitalScreen("studies");
  }
}

// --------------------------------------------------------------------------
// Event Bindings
// --------------------------------------------------------------------------
function bindEvents() {
  initializeViewerStudio({ openViewer:openClinicianHomeViewer, renewAccess:typeof renewViewerAccess !== 'undefined' ? renewViewerAccess : undefined,
    canRenew:()=>currentPersona === "DOCTOR" && !consentMutationPending && !tokenRequestPending });
  const transferActions=initializeTransferActions({
    readHistory:()=>fetchJson('/api/pacs-transfer-jobs/history',{cache:'no-store'}),
    readJob:id=>fetchJson(`/api/pacs-transfer-jobs/${encodeURIComponent(id)}`,{cache:'no-store'}),
    stageSelected:stageSelectedInstanceForPacs,
    active:()=>currentPersona==='DOCTOR',
    context:()=>({selected:!!selectedSopUid,busy:pacsImportBusy,
      consent:getConsentForStudy(selectedStudyUid,lastConsents)})
  });
  if(transferActions){
    const hospitalApp=document.querySelector('#hospital-saas-app');
    const resetObserver=new MutationObserver(()=>transferActions.update());
    resetObserver.observe(hospitalApp,{attributes:true,attributeFilter:['hidden']});
    const viewportObserver=new MutationObserver(()=>transferActions.update());
    viewportObserver.observe(viewerImage,{attributes:true,attributeFilter:['src','hidden']});
    hospitalApp.querySelectorAll('.mq-nav,[data-view-jump]').forEach(button=>button.addEventListener('click',()=>{
      transferActions.update();if(button.dataset.view==='transfer'||button.dataset.viewJump==='transfer')void transferActions.load();
    }));
    document.querySelector('#load-instances')?.addEventListener('click',()=>transferActions.update());
    document.querySelector('#btn-pacs-import-run')?.addEventListener('click',()=>transferActions.watch());
    document.querySelector('#btn-resume-pacs-job')?.addEventListener('click',()=>transferActions.watch());
    window.addEventListener('pagehide',()=>transferActions.clear());
  }
  // Global & Refresh
  document.querySelector("#refresh")?.addEventListener("click", loadDashboard);
  document.querySelector("#home-refresh-btn")?.addEventListener("click", loadDashboard);

  // Patient Actions
  document.querySelector("#patient-consent")?.addEventListener("click", createPatientConsent);
  document.querySelector("#patient-revoke")?.addEventListener("click", revokePatientConsent);
  document.querySelector("#btn-quick-approve")?.addEventListener("click", () => navigatePatientPage("consent"));
  document.querySelector("#btn-quick-revoke")?.addEventListener("click", async () => {
    showToast("동의를 철회하는 중입니다...");
    const acknowledged = await revokePatientConsent();
    if (acknowledged) showToast("가상 병원 B 진료 의뢰 동의가 철회되었습니다. 병원 SaaS 콘솔에 즉시 동기화됩니다.");
  });
  sourceHospitalSelect?.addEventListener("change", syncPatientChoices);
  targetHospitalSelect?.addEventListener("change", () => {
    syncPatientChoices(); latestConsentId=null; consentViewRevision++;
    latestTicketNonce=null; updateVisitModePacket(null);
    updateConsentState(lastConsents); shareReview?.refresh();
  });
  accessPurposeSelect?.addEventListener("change", syncPatientChoices);
  accessModeSelect?.addEventListener("change", syncPatientChoices);
  patientStudySelect?.addEventListener("change", () => selectStudy(patientStudySelect.value, lastStudies));
  document.querySelector('#share-reload-studies')?.addEventListener('click', async event => {
    event.currentTarget.disabled=true;
    try { await loadDashboard({skipPhr:true}); } catch { /* loadDashboard renders the failure state. */ }
    finally { document.querySelector('#share-reload-studies').disabled=false; }
  });
  patientSeriesSelect?.addEventListener("change", () => {
    selectedSeriesUid = patientSeriesSelect.value;
    resetViewerData();
  });
  document.querySelector("#phr-refresh")?.addEventListener("click", loadPhrDashboard);
  document.querySelector("#toggle-easy-mode")?.addEventListener("click", toggleEasyMode);
  document.querySelector("#easyModeToggle")?.addEventListener("click", toggleEasyMode);

  // Patient Action Center Guided Direct Action & Deep Links
  document.querySelector("#btn-consent-detail")?.addEventListener("click", () => {
    if (sourceHospitalSelect) sourceHospitalSelect.value = "HOSP-A";
    if (targetHospitalSelect) targetHospitalSelect.value = "HOSP-B";
    if (accessPurposeSelect) accessPurposeSelect.value = "TREATMENT";
    if (accessModeSelect) accessModeSelect.value = "VIEW_ONLY";
    if (patientStudySelect && selectedStudyUid) patientStudySelect.value = selectedStudyUid;
    syncPatientChoices({ preserveConsentState: true });
    navigatePatientPage("consent");
    showToast("가상 병원 B 진료 의뢰 조건이 동의 설정 폼에 자동 입력되었습니다.");
  });

  document.querySelector("#btn-action-visit")?.addEventListener("click", async () => {
    if (!latestTicketNonce && latestConsentId) {
      try {
        const handoff = await postJson(`/api/consents/${encodeURIComponent(latestConsentId)}/handoff-ticket`, {});
        if (handoff?.qr?.payload) {
          const match = handoff.qr.payload.match(/\/t\/([A-Za-z0-9_-]{22,128})$/);
          if (match) latestTicketNonce = match[1];
          updateVisitModePacket(handoff);
        }
      } catch {
        // non-fatal deferred
      }
    }
    navigatePatientPage("visit");
    showToast("병원 창구 제시용 1회용 QR 방문 패킷이 준비되었습니다.");
  });

  document.querySelector("#btn-action-receipts")?.addEventListener("click", () => {
    navigatePatientPage("activity");
    showToast("발행된 접근 영수증 내역입니다.");
  });

  document.querySelector("#btn-head-transfer")?.addEventListener("click", () => {
    navigatePatientPage("images");
    showToast("가상 병원 B로 전송할 의료영상을 선택해주세요.");
  });

  document.querySelector("#btn-action-go-images")?.addEventListener("click", () => {
    navigatePatientPage("images");
    showToast("전송할 의료영상을 선택해주세요.");
  });

  document.querySelector("#btn-head-visit")?.addEventListener("click", () => {
    if (patientConsentReady) {
      navigatePatientPage("activity");
      showToast("활성화된 전송 현황 및 영수증 화면입니다.");
    } else {
      navigatePatientPage("home");
      const target = document.querySelector("#patient-action-consent-card");
      pulseHighlightElement(target);
      showToast("병원 방문 전 가상 병원 B 진료 의뢰 동의를 먼저 승인하세요.");
    }
  });

  // Action Center Summary Grid Cards Direct Action
  document.querySelector("#summary-card-requests")?.addEventListener("click", () => {
    navigatePatientPage("home");
    const target = document.querySelector("#patient-action-consent-card");
    pulseHighlightElement(target);
    if (!patientConsentReady) {
      showToast("가상 병원 B 진료 의뢰 동의가 대기 중입니다. [동의 승인]을 누르면 즉시 연계됩니다.");
    } else {
      showToast("이미 가상 병원 B 진료 의뢰 동의가 승인되어 있습니다.");
    }
  });

  document.querySelector("#summary-card-studies")?.addEventListener("click", () => {
    navigatePatientPage("images");
    showToast("보관 중인 의료영상 목록으로 이동했습니다.");
  });

  document.querySelector("#summary-card-access")?.addEventListener("click", () => {
    navigatePatientPage("activity");
    showToast("의료진 열람 감사 영수증 화면으로 이동했습니다.");
  });

  document.querySelector("#summary-card-consent")?.addEventListener("click", () => {
    if (patientConsentReady) {
      navigatePatientPage("consent");
      showToast("현재 활성화된 공유 동의 관리 화면입니다.");
    } else {
      navigatePatientPage("home");
      const target = document.querySelector("#patient-action-consent-card");
      pulseHighlightElement(target);
      showToast("동의 대기 상태입니다. [동의 승인]을 눌러 진료 의뢰를 승인하세요.");
    }
  });

  // Recent Imaging Study Cards Jumps directly to Consent
  document.querySelectorAll("[data-action-study]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const studyUid = btn.dataset.actionStudy;
      if (studyUid) {
        await selectStudy(studyUid, lastStudies);
        const study = lastStudies.find((s) => s.studyInstanceUid === studyUid);
        if (sourceHospitalSelect) sourceHospitalSelect.value = study?.sourceHospitalId || "HOSP-A";
        if (targetHospitalSelect) targetHospitalSelect.value = "HOSP-B";
        if (accessPurposeSelect) accessPurposeSelect.value = "TREATMENT";
        if (accessModeSelect) accessModeSelect.value = "VIEW_ONLY";
        syncPatientChoices({ preserveConsentState: true });
        navigatePatientPage("consent");
        const name = study?.description || "의료영상";
        showToast(`[${name}] 영상이 선택되었습니다. 수신 병원(가상 병원 B)을 확인하고 동의를 제출하세요.`);
      }
    });
  });

  // Patient Direct View from Home Cards
  document.querySelectorAll("[data-patient-view-home]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const studyUid = btn.dataset.patientViewHome;
      if (studyUid) openPatientStudyViewer(studyUid);
    });
  });

  setupPatientViewerModalEvents();

  // Keyboard accessibility for summary cards
  document.querySelectorAll('.summary-card[role="button"]').forEach((card) => {
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
  });

  // Doctor Actions
  const detailDialog = document.querySelector('#desk-details-dialog');
  const openDetails = () => { if (detailDialog && !detailDialog.open) detailDialog.showModal(); };
  document.querySelector('#desk-open-details')?.addEventListener('click',openDetails);
  document.querySelector('#desk-close-details')?.addEventListener('click',() => detailDialog.close());
  detailDialog?.querySelectorAll('[data-view-jump]').forEach(button => button.addEventListener('click',() => detailDialog.close()));
  document.querySelector('#clinical-open-viewer')?.addEventListener('click', async () => {
    const button=document.querySelector('#clinical-open-viewer');
    const next=clinicalNextAction(selectedStudy,getConsentForStudy(selectedStudyUid,lastConsents),latestTokenInfo,!viewerImage.hidden);
    if (next.action==='details') { openDetails(); return; }
    if (next.action==='qr') { navigateHospitalScreen('dashboard'); return; }
    button.disabled=true;
    try { if (next.action==='refresh') await loadDashboard(); else await openClinicianHomeViewer(); }
    catch { showToast('연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { button.disabled=false; refreshClinicalNextAction(); }
  });
  if (viewerImage) new MutationObserver(refreshClinicalNextAction).observe(viewerImage,{attributes:true,attributeFilter:['src','hidden']});
  document.querySelector('#clinician-search')?.addEventListener('input', () => renderDoctorStudies(lastStudies));
  document.querySelector('#clinician-filter')?.addEventListener('change', () => renderDoctorStudies(lastStudies));
  document.querySelector("#doctor-request-token")?.addEventListener("click", requestDoctorToken);
  document.querySelector("#doctor-open-series")?.addEventListener("click", openViewer);
  document.querySelector("#load-studies")?.addEventListener("click", async () => {
    const button = document.querySelector('#load-studies');
    button.disabled = true;
    button.textContent = '불러오는 중…';
    try {
      await loadDashboard();
      showToast('의료영상 목록이 갱신되었습니다.');
    } catch {
      showToast('목록을 갱신하지 못했습니다. 연결을 확인한 후 다시 시도하세요.');
    } finally {
      button.disabled = false;
      button.textContent = '상태 새로고침';
    }
  });
  document.querySelector("#load-instances")?.addEventListener("click", loadInstancesForSelectedSeries);
  downloadButton?.addEventListener("click", downloadSelectedInstance);
  auditResultFilter?.addEventListener("change", loadAuditTimeline);
  auditActionFilter?.addEventListener("change", loadAuditTimeline);
  document.querySelector('#audit-refresh')?.addEventListener('click',loadAuditTimeline);

  // Break-Glass Emergency Override
  document.querySelector("#btn-trigger-break-glass")?.addEventListener("click", () => showBreakGlassModal(demo.doctorId));

  // PACS Import Actions
  document.querySelector("#btn-preflight-check")?.addEventListener("click", runPreflightCheck);
  document.querySelector('#vault-refresh')?.addEventListener('click',loadHospitalBPacsArchive);
  document.querySelector('#pacs-import-confirm')?.addEventListener('change', event => {
    const run = document.querySelector('#btn-pacs-import-run');
    if (run) run.disabled = pacsImportBusy || activeTransferJobs.length > 0 || !isPreflightPassed || !event.target.checked;
  });
  document.querySelector('#btn-add-series-transfer-items')?.addEventListener('click', addCurrentSeriesToTransfer);
  document.querySelector('#transfer-selection-list')?.addEventListener('click', event => {
    if(pacsImportBusy || activeTransferJobs.length > 0)return;
    const button = event.target.closest('[data-remove-transfer-item]');
    if (!button) return;
    transferQueue.splice(Number(button.dataset.removeTransferItem), 1);
    if (!transferQueue.length) transferQueueConsentId = "";
    renderTransferSelection();
    runPreflightCheck();
  });
  document.querySelector('#transfer-job-select')?.addEventListener('change', event => {
    activeTransferJobId = event.target.value;
    const selected = activeTransferJobs.find(job => job.jobId === activeTransferJobId);
    const status = document.querySelector('#transfer-job-resume-status');
    if (status && selected) status.textContent = `작업 상태 ${selected.state} · ${selected.succeededItems}/${selected.totalItems} 완료 · ${selected.failedItems}건 실패`;
    renderTransferSelection();
  });
  document.querySelector('#btn-resume-pacs-job')?.addEventListener('click', async () => {
    if (!activeTransferJobId || pacsImportBusy) return;
    pacsImportBusy = true;
    renderTransferSelection();
    try { await processPacsTransferJob(activeTransferJobId); }
    catch (error) { showTransferFailure(error); }
    finally { pacsImportBusy = false; await restorePacsTransferJob(); renderTransferSelection(); }
  });
  document.querySelector("#btn-pacs-import-run")?.addEventListener("click", runPacsImport);
  document.querySelector("#btn-refresh-pacs-archive")?.addEventListener("click", () => {
    loadHospitalBPacsArchive();
  });

  // QR Handoff Scanner Actions
  document.querySelector("#btn-simulate-qr-scan")?.addEventListener("click", simulateQrScan);
  document.querySelector("#btn-reset-qr-scan")?.addEventListener("click", resetQrScan);
  document.querySelector('#qr-manual-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.querySelector('#qr-manual-input');
    const value = input.value.trim();
    let nonce = /^[A-Za-z0-9_-]{22,128}$/.test(value) ? value : null;
    if (!nonce) {
      const safe = safeSameOriginHandoffUrl(value);
      if (safe) nonce = new URL(safe, location.origin).pathname.match(/\/t\/([A-Za-z0-9_-]{22,128})$/)?.[1];
    }
    if (!nonce) {
      resetQrScan();
      document.querySelector('#qr-handoff-message').textContent = '연결 정보를 확인해 주세요. 이 서비스의 공유 링크 또는 연결 코드를 입력해야 합니다.';
      input.focus();
      return;
    }
    await redeemScannedNonce(nonce, input.dataset.demoImport==='1'?'DEMO_IMPORT':'MANUAL');
    delete input.dataset.demoImport;
    input.value = '';
  });
  document.querySelector("#btn-toggle-camera-scan")?.addEventListener("click", toggleCameraQrScan);

  // Cloud Viewer Tools
  document.querySelector("#tool-invert")?.addEventListener("click", toggleInvert);
  document.querySelector("#tool-zoom")?.addEventListener("click", cycleZoom);
  document.querySelector("#tool-pan")?.addEventListener("click", togglePan);
  document.querySelector("#tool-reset")?.addEventListener("click", resetViewerTools);
  document.querySelector("#tool-ww-wl")?.addEventListener("click", cycleWwWl);
  document.querySelector("#tool-side-by-side")?.addEventListener("click", toggleSideBySide);
  document.querySelector("#tool-cine-play")?.addEventListener("click", toggleCinePlayback);
  document.querySelector("#tool-cine-fps")?.addEventListener("click", cycleCineFps);

  // Multi-Slice Stack Navigation & Scrubber
  document.querySelector("#btn-prev-slice")?.addEventListener("click", () => stepSlice(-1));
  document.querySelector("#btn-next-slice")?.addEventListener("click", () => stepSlice(1));
  document.querySelector("#viewer-slice-slider")?.addEventListener("input", (e) => {
    const targetIdx = parseInt(e.target.value, 10) - 1;
    displaySlice(targetIdx);
  });

  // Mouse Wheel Scrubbing on Viewport
  const viewportBox = document.querySelector("#viewer-viewport-box");
  viewportBox?.addEventListener("wheel", (e) => {
    if (lastInstances.length <= 1) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      stepSlice(1);
    } else if (e.deltaY < 0) {
      stepSlice(-1);
    }
  }, { passive: false });

  // Keyboard navigation when viewer screen is active
  window.addEventListener("keydown", (e) => {
    const viewerScreen = document.querySelector('.mq-screen[data-screen="viewer"]');
    if (!viewerScreen || viewerScreen.hidden) return;
    if (["ArrowUp", "PageUp"].includes(e.key)) {
      e.preventDefault();
      stepSlice(-1);
    } else if (["ArrowDown", "PageDown"].includes(e.key)) {
      e.preventDefault();
      stepSlice(1);
    } else if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      toggleCinePlayback();
    }
  });

  // Modal Closures
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });
}

function initConsentDateDefaults() {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (consentValidFromInput) consentValidFromInput.value = toDateTimeLocal(now);
  if (consentValidUntilInput) consentValidUntilInput.value = toDateTimeLocal(nextWeek);
}

// --------------------------------------------------------------------------
// Core Dashboard Data Loading
// --------------------------------------------------------------------------
async function loadDashboard(options = {}) {
  // Background heartbeat must not stack another seven-request snapshot while
  // a previous refresh is pending. Explicit post-mutation reads stay fresh.
  if (options.background && (dashboardLoadsInFlight > 0 || consentMutationPending || tokenRequestPending)) return;
  dashboardLoadsInFlight++;
  try {
    return await fetchDashboardSnapshot(options);
  } catch (error) {
    if (typeof document !== "undefined") {
      walletSnapshotReady=false;
      patientStudySnapshotAvailable=false;
      if(patientStudySelect)patientStudySelect.disabled=true;
      const studyState=document.querySelector('#share-study-state');
      if(studyState){studyState.textContent='검사 목록을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.';studyState.dataset.state='error';}
      shareReview?.refresh(consentMutationPending);
      patientSharing?.update([],lastConsents,consentMutationPending);
      demoTools?.update();
      clinicianHome?.fail();
      walletHome?.update({name:demo.patientName,error:true});
      const state = document.querySelector("#patient-read-state");
      if (state) { state.textContent = "최신 정보를 확인하지 못했습니다. 연결을 확인하고 새로고침해 주세요."; state.dataset.state = "error"; }
    }
    throw error;
  } finally {
    dashboardLoadsInFlight--;
  }
}

async function fetchDashboardSnapshot(options = {}) {
  const requestSequence = ++dashboardRequestSequence;
  const personaAtRequest = currentPersona;
  const selectionAtRequest = latestConsentId;
  const revisionAtRequest = consentViewRevision;
  if (currentPersona === 'DOCTOR' && capstoneAuth?.roles?.includes('SECURITY_ADMIN') && !capstoneAuth.roles.includes('DOCTOR')) {
    walletSnapshotReady = true;
    demoTools?.update();
    return;
  }
  if(currentPersona==='DOCTOR'&&typeof location!=='undefined'&&location.hostname==='highpass-demo.japaneast.cloudapp.azure.com'){
    const result=await fetchJson('/api/clinician/receptions',{cache:'no-store'});
    if(!Array.isArray(result.receptions))throw Error('RECEPTIONS_UNAVAILABLE');
    if(personaAtRequest!==currentPersona||requestSequence<dashboardAppliedSequence||revisionAtRequest!==consentViewRevision||selectionAtRequest!==latestConsentId)return;
    dashboardAppliedSequence=requestSequence;
    const rows=result.receptions.filter(r=>r.status==='CONSENT_ACTIVE'&&r.consent);
    lastConsents=[...new Map(rows.map(r=>[r.consentId,r.consent])).values()];
    lastStudies=[...new Map(rows.flatMap(r=>r.studies).map(s=>[s.studyInstanceUid,s])).values()];
    if(selectedStudyUid&&!lastStudies.some(s=>s.studyInstanceUid===selectedStudyUid)){selectedStudy=null;selectedStudyUid='';latestToken=null;latestTokenInfo=null;resetViewerData();}
    selectedStudy=lastStudies.find(s=>s.studyInstanceUid===selectedStudyUid)||null;
    updateConsentState(lastConsents);renderDoctorStudies(lastStudies);walletSnapshotReady=true;demoTools?.update();return;
  }
  const auditParams = new URLSearchParams();
  if (auditResultFilter?.value) auditParams.set("result", auditResultFilter.value);
  if (auditActionFilter?.value) auditParams.set("action", auditActionFilter.value);
  const auditQuery = auditParams.toString();

  // Public patient pages do not need operational health/admin endpoints.
  // Keep both patient reads atomic; neither is a substitute for authorization.
  const patientOnly = Boolean(capstoneAuth) && currentPersona === "PATIENT";
  const results = await fetchDashboardReads(patientOnly ? [
    `/api/imaging-studies?patientId=${encodeURIComponent(demo.patientId)}&includeSeries=true`,
    `/api/patients/${encodeURIComponent(demo.patientId)}/consents`,
  ] : [
    "/api/health",
    `/api/imaging-studies?patientId=${demo.patientId}&includeSeries=true`,
    `/api/patients/${demo.patientId}/consents`,
    ...(currentPersona === "PATIENT" ? [] : [
      `/api/audit-logs${auditQuery ? `?${auditQuery}` : ""}`,
      "/api/transfer-usage", "/api/anomaly-alerts", "/api/security/quarantines?all=true",
    ]),
  ], options.background === true);
  const [health, studies, consents, logs, usage, anomalies, quarantines] = patientOnly ? [null, ...results] : results;

  // A delayed heartbeat must never replace a newer selection or a mutation's
  // confirmed outcome. Server authorization remains the only access authority.
  if (requestSequence < dashboardAppliedSequence || selectionAtRequest !== latestConsentId || revisionAtRequest !== consentViewRevision || personaAtRequest !== currentPersona) return;
  if (!Array.isArray(studies) || !Array.isArray(consents) || health?.error) throw new Error("PATIENT_SNAPSHOT_UNAVAILABLE");
  dashboardAppliedSequence = requestSequence;
  lastConsents = Array.isArray(consents) ? consents : [];
  applyPatientStudySnapshot(studies);
  walletSnapshotReady=true;
  refreshWalletHome();
  updateConsentState(lastConsents);
  renderPatientOverview(lastStudies, { onView: study => openPatientStudyViewer(study.studyInstanceUid), onShare: study => {
    selectStudy(study.studyInstanceUid, lastStudies);
    if (sourceHospitalSelect) sourceHospitalSelect.value = study.sourceHospitalId;
    syncPatientChoices({ preserveConsentState: true });
    navigatePatientPage("consent");
  } });
  renderPresentationScenario(capstoneAuth?.context, {
    study: lastStudies.find(study => study.studyInstanceUid === demo.studyInstanceUid),
    consent: selectConsentForStudy(lastConsents, { studyUid: demo.studyInstanceUid, targetHospitalId: demo.targetHospitalId, preferredConsentId: latestConsentId }),
    onView: study => openPatientStudyViewer(study.studyInstanceUid),
    onShare: study => { selectStudy(study.studyInstanceUid, lastStudies); if (sourceHospitalSelect) sourceHospitalSelect.value = study.sourceHospitalId;
      if (targetHospitalSelect) targetHospitalSelect.value = demo.targetHospitalId; syncPatientChoices({ preserveConsentState: true }); navigatePatientPage('consent'); },
  });
  const readState = document.querySelector("#patient-read-state");
  if (readState) { readState.textContent = "서버 정보 확인 · " + new Date().toLocaleTimeString("ko-KR"); readState.dataset.state = "ready"; }
  clinicalRecentLogs = Array.isArray(logs) ? logs : [];
  renderDoctorStudies(lastStudies);
  renderLogs(Array.isArray(logs) ? logs : []);
  renderAnomalies(Array.isArray(anomalies) ? anomalies : []);
  renderQuarantines(Array.isArray(quarantines) ? quarantines : []);
  renderConsentHistory(Array.isArray(consents) ? consents : []);
  renderMetrics(lastStudies, Array.isArray(logs) ? logs : [], Array.isArray(usage) ? usage : []);
  if (health) renderHealth(health);
  renderPatientReceipts(Array.isArray(consents) ? consents : [], Array.isArray(logs) ? logs : []);
  updatePipelineSteps();
  if (currentPersona !== "PATIENT") await loadHospitalBPacsArchive();

  if (!options?.skipPhr) {
    await loadPhrDashboard();
  }
}

async function fetchDashboardReads(paths, background = false) {
  if (!background) return Promise.all(paths.map(path => fetchJson(path)));
  // Leave same-origin browser connection capacity for interactive policy/token
  // requests. Do not change any request timeout, security delay or credentials.
  const results = new Array(paths.length);
  let next = 0;
  let interrupted = false;
  let failed = false;
  let failure;
  const worker = async () => {
    while (next < paths.length && !interrupted && !failed) {
      if (consentMutationPending || tokenRequestPending) { interrupted = true; return; }
      const index = next++;
      try { results[index] = await fetchJson(paths[index]); }
      catch (error) { failed = true; failure = error; throw error; }
    }
  };
  // Drain already-started reads before the wrapper releases its in-flight guard.
  // Never apply a partial snapshot or turn a failed read into a successful read.
  await Promise.allSettled(Array.from({ length: Math.min(2, paths.length) }, worker));
  if (failed) throw failure;
  if (interrupted) throw new Error("DASHBOARD_BACKGROUND_INTERRUPTED");
  return results;
}

// --------------------------------------------------------------------------
// FHIR R4 Personal Health Record (PHR) Module
// --------------------------------------------------------------------------
async function loadPhrDashboard() {
  if (capstoneAuth) {
    if(currentPersona!=='PATIENT')return;
    if(!scenarioHealthStandard)scenarioHealthStandard=createScenarioHealthStandard({
      root:document.querySelector('#patient-phr .health-standard'),request:path=>fetchJson(path,{cache:'no-store',headers:capstoneAuth.headers('PATIENT')}),
      available:()=>currentPersona==='PATIENT',
      onSnapshot:async snapshot=>{applyPatientStudySnapshot(snapshot.studies);await syntheticHealthClient?.load({force:true});if(syntheticHealthClient?.status()==='ERROR')throw new Error('HEALTH_RECORDS_UNAVAILABLE');},
      onView:study=>openPatientStudyViewer(study.studyInstanceUid),
    });
    return scenarioHealthStandard.load();
  }
  setPhrState("합성 PHR 데이터를 불러오는 중입니다.", "loading");
  try {
    const [summary, imaging] = await Promise.all([
      fetchJson("/api/v1/me/phr/summary"),
      fetchJson("/api/v1/me/phr/imaging-studies?limit=20"),
    ]);

    if (!summary?.data || !Array.isArray(imaging?.data)) {
      throw new Error(summary?.code ?? imaging?.code ?? "PHR_REQUEST_FAILED");
    }

    const patientNameEl = document.querySelector("#phr-patient-name");
    const encCountEl = document.querySelector("#phr-encounter-count");
    const obsCountEl = document.querySelector("#phr-observation-count");
    const imgCountEl = document.querySelector("#phr-imaging-count");

    if (patientNameEl) patientNameEl.textContent = summary.data.patient?.displayName ?? demo.patientName;
    if (encCountEl) encCountEl.textContent = String(summary.data.counts?.encounters ?? 0);
    if (obsCountEl) obsCountEl.textContent = String(summary.data.counts?.observations ?? 0);
    if (imgCountEl) imgCountEl.textContent = String(summary.data.counts?.imagingStudies ?? 0);

    renderPhrImaging(imaging.data);
    setPhrState(`합성 FHIR R4 자료 ${imaging.data.length}건을 확인했습니다.`, "success");
  } catch (error) {
    renderPhrImaging([]);
    setPhrState(toFriendlyError(error?.message), "fail");
  }
}

function renderPhrImaging(items) {
  if (!phrImagingList) return;
  if (!items.length) {
    phrImagingList.innerHTML = '<div class="notice">표시할 합성 FHIR ImagingStudy가 없습니다.</div>';
    return;
  }

  phrImagingList.innerHTML = items.map((item) => {
    const mapped = item.mappingStatus === "MAPPED";
    const modality = Array.isArray(item.modality)
      ? item.modality.map((entry) => entry?.code ?? entry?.display).filter(Boolean).join(", ")
      : "DICOM";

    return `
      <article class="phr-imaging-item">
        <div>
          <strong>${escapeHtml(item.description)}</strong>
          <div class="meta">${escapeHtml(modality || "DICOM")} / ${escapeHtml(item.started)} / 합성 데이터</div>
          <div class="meta">매핑: ${escapeHtml(item.mappingStatus)} / 접근: ${escapeHtml(item.accessStatus)}</div>
        </div>
        ${mapped
          ? `<button class="btn small primary" type="button" data-phr-consent-ref="${escapeHtml(item.imagingStudyRef)}">이 영상 공유 동의</button>`
          : '<span class="status red">Viewer 연결 불가</span>'}
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-phr-consent-ref]").forEach((button) => {
    button.addEventListener("click", () => createPhrConsent(button.dataset.phrConsentRef));
  });
}

async function createPhrConsent(imagingStudyRef) {
  if (phrHandoffLink) {
    phrHandoffLink.hidden = true;
    phrHandoffLink.removeAttribute("data-expires-at");
  }
  setPhrState("선택한 ImagingStudy의 공유 범위를 서버에서 검증하고 있습니다.", "loading");

  const result = await postJson(`/api/v1/me/phr/imaging-studies/${encodeURIComponent(imagingStudyRef)}/consents`, {
    targetHospitalId: targetHospitalSelect ? targetHospitalSelect.value : demo.targetHospitalId,
    purpose: accessPurposeSelect ? accessPurposeSelect.value : demo.purpose,
    permission: accessModeSelect ? accessModeSelect.value : demo.permission,
    validFrom: toIsoFromLocal(consentValidFromInput.value),
    validUntil: toIsoFromLocal(consentValidUntilInput.value),
  });

  if (result?.data?.consentId) {
    latestConsentId = result.data.consentId;
    const handoff = await postJson(`/api/consents/${encodeURIComponent(result.data.consentId)}/handoff-ticket`, {});
    const handoffUrl = safeSameOriginHandoffUrl(handoff?.qr?.payload);

    if (!handoffUrl) {
      setPhrState(`공유 동의는 생성되었지만 Viewer handoff 발급이 거부되었습니다: ${toFriendlyError(handoff?.error)}`, "fail");
      renderOutput({ status: result.data.status, consentId: result.data.consentId, handoff: handoff?.error ?? "HANDOFF_FAILED" });
      return;
    }

    if (phrHandoffLink) {
      phrHandoffLink.href = handoffUrl;
      phrHandoffLink.dataset.expiresAt = handoff.qr.expiresAt;
      phrHandoffLink.hidden = false;
    }
    setPhrState(`공유 동의와 일회용 Viewer handoff가 생성되었습니다. ${formatExpiry(handoff.qr.expiresAt)}까지 유효합니다.`, "success");
    renderOutput({
      status: result.data.status,
      consentId: result.data.consentId,
      permission: result.data.permission,
      purpose: result.data.purpose,
      targetHospital: result.data.targetHospitalId,
      handoffStatus: handoff.ticket?.status,
      handoffExpiresAt: handoff.qr.expiresAt,
    });
    broadcastSync("CONSENT_CREATED");
    await loadDashboard();
    switchPersona("PATIENT");
    navigatePatientPage("phr");
    return;
  }

  setPhrState(toFriendlyError(result?.code ?? result?.error), "fail");
  renderOutput(result);
}

function capturePhrHandoffNonce() {
  const match = location.pathname.match(/^\/t\/([A-Za-z0-9_-]{22,128})$/);
  if (!match) return null;
  history.replaceState(null, "", "/hipass/#DOCTOR");
  return match[1];
}

function safeSameOriginHandoffUrl(payload) {
  try {
    const parsed = new URL(payload, location.origin);
    if (parsed.origin !== location.origin || !/^\/t\/[A-Za-z0-9_-]{22,128}$/.test(parsed.pathname)) return null;
    return `${parsed.pathname}`;
  } catch {
    return null;
  }
}

function formatExpiry(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "잠시 후" : parsed.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

async function redeemPhrHandoff(nonce) {
  switchPersona("DOCTOR");
  navigateHospitalScreen("viewer");
  showViewerMessage("일회용 handoff와 의료진 소속을 서버에서 검증하고 있습니다.", "info");

  const result = await postJson("/api/transfers/tickets/redeem-viewer", { nonce });
  if (result?.decision !== "ALLOWED" || !result.accessToken || !result.viewerContext?.studyInstanceUid) {
    latestToken = null;
    latestTokenInfo = null;
    if (viewerStatus) viewerStatus.textContent = "Handoff denied";
    showViewerMessage(toFriendlyError(result?.reasonCode ?? result?.error), "fail");
    renderOutput({ decision: result?.decision ?? "DENIED", reasonCode: result?.reasonCode ?? result?.error ?? "HANDOFF_FAILED" });
    return;
  }

  latestToken = result.accessToken;
  latestTokenInfo = result;
  latestConsentId = result.consentId ?? latestConsentId;
  selectedStudyUid = result.viewerContext.studyInstanceUid;
  selectedSeriesUid = result.viewerContext.seriesInstanceUid ?? "";
  selectedStudy = lastStudies.find((study) => study.studyInstanceUid === selectedStudyUid) ?? selectedStudy;
  if (viewerStatus) viewerStatus.textContent = "Handoff verified";
  syncSelectedStudyUi();
  setDownloadState();
  showViewerMessage("일회용 handoff 검증이 완료되었습니다. 승인된 Series만 불러옵니다.", "success");
  renderOutput({
    decision: result.decision,
    handoff: "CONSUMED",
    permission: result.viewerContext.permission,
    targetHospital: result.viewerContext.targetHospitalId,
  });

  startCountdownTimer(result.expiresAt);
  updateWatermark(result);
  updatePipelineSteps();
  broadcastSync("HANDOFF_REDEEMED");
  await loadGatewayStudies();
  await loadSeriesForActiveToken();
}

function setPhrState(message, tone) {
  if (!phrLoadState) return;
  phrLoadState.textContent = message;
  phrLoadState.dataset.tone = tone;
}

// --------------------------------------------------------------------------
// Consent Management & Hospital SaaS Real-time State Binding
// --------------------------------------------------------------------------
function renderActiveTransferCard(activeConsent) {
  const container = document.querySelector("#patient-active-transfer-banner");
  if (!container) return;
  if (activeConsent) {
    const study = lastStudies.find((s) => s.studyInstanceUid === selectedStudyUid) || lastStudies[0];
    const studyTitle = study?.description || "선택된 의료영상";
    container.innerHTML = `
      <div class="action-card" style="border: 2px solid #16a34a; background: #f0fdf4; padding: 18px; margin-bottom: 20px;">
        <div class="action-symbol" style="--soft:#dcfce7;--tone:#16a34a;font-size:22px;">✓</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;">
            <h3 style="margin:0;color:#166534;font-size:16px;">현재 공유 동의: ${escapeHtml(studyTitle)}</h3>
            <span class="status green">동의 유효 (ACTIVE)</span>
          </div>
          <p style="margin:6px 0 0;color:#15803d;font-size:13px;">
            수신 병원: <strong>${escapeHtml(activeConsent.targetHospitalId)}</strong> · 목적: ${escapeHtml(activeConsent.purpose || demo.purpose)} · 권한: ${escapeHtml(activeConsent.permission || demo.permission)}
          </p>
          <p style="margin:3px 0 0;color:#166534;font-size:12px;">
            유효기간: ${escapeHtml(formatDate(activeConsent.validUntil))}까지 동의 유효 · 실제 접근 시 권한 확인
          </p>
        </div>
        <div>
          <button id="btn-activity-revoke" class="btn small" type="button" style="color:var(--red);border-color:var(--red-soft);background:#ffffff;font-weight:700;">
            전송 즉시 철회
          </button>
        </div>
      </div>
    `;
    container.querySelector("#btn-activity-revoke")?.addEventListener("click", async () => {
      showToast("전송 동의를 철회하는 중입니다...");
      const acknowledged = await revokePatientConsent();
      if (acknowledged) showToast("의료영상 전송이 즉시 철회되었습니다. 병원 SaaS 조회가 차단됩니다.");
    });
  } else {
    container.innerHTML = `
      <div class="action-card" style="border: 1px dashed #cbd5e1; background: #ffffff; padding: 16px; margin-bottom: 20px;">
        <div class="action-symbol" style="--soft:#f1f5f9;--tone:#64748b;font-size:20px;">📋</div>
        <div style="flex:1;">
          <h3 style="margin:0;color:#475569;font-size:15px;">선택한 영상의 유효한 공유 동의가 없습니다.</h3>
          <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
            다른 병원으로 영상을 전달해야 하는 경우, [내 의료영상 확인]에서 영상을 선택하여 전송하세요.
          </p>
        </div>
        <div>
          <button class="btn small primary" type="button" id="btn-activity-go-images">영상 전송 시작</button>
        </div>
      </div>
    `;
    container.querySelector("#btn-activity-go-images")?.addEventListener("click", () => navigatePatientPage("images"));
  }
}

function getConsentForStudy(studyUid, consents = lastConsents) {
  return selectConsentForStudy(consents, { studyUid, targetHospitalId: demo.targetHospitalId, preferredConsentId: latestConsentId });
}

function findConsentForStudy(studyUid, consents = lastConsents) {
  const selected = getConsentForStudy(studyUid, consents);
  return selected?.status === "ACTIVE" ? selected : null;
}

function updateConsentState(consents) {
  if (consentMutationPending) { updateConsentOperationControls(); return; }
  const selected = getConsentForStudy(selectedStudyUid, consents);
  const active = findConsentForStudy(selectedStudyUid, consents);

  const quickApproveBtn = document.querySelector("#btn-quick-approve");
  const quickRevokeBtn = document.querySelector("#btn-quick-revoke");
  const actionConsentBadge = document.querySelector("#patient-action-consent-badge");
  const actionConsentDesc = document.querySelector("#patient-action-consent-desc");

  if (active) {
    latestConsentId = active.consentId;
    patientConsentReady = true;
    setPatientStatus("동의 완료 (ACTIVE)");

    if (quickApproveBtn) quickApproveBtn.style.display = "none";
    if (quickRevokeBtn) quickRevokeBtn.style.display = "inline-flex";
    if (actionConsentBadge) {
      actionConsentBadge.textContent = "동의 완료 (ACTIVE)";
      actionConsentBadge.className = "status green";
    }
    if (actionConsentDesc) {
      actionConsentDesc.textContent = `${active.targetHospitalId} 공유 동의 유효 · 실제 열람 시 권한을 확인합니다.`;
    }
  } else {
    patientConsentReady = false;
    latestConsentId = selected?.consentId ?? null;
    updateVisitModePacket(null);
    if (latestToken || latestTicketNonce) {
      clearCountdownTimer();
      latestToken = null;
      latestTokenInfo = null;
      latestTicketNonce = null;
      resetViewerData();
    }
    const label = selected?.status === "REVOKED" ? "동의 철회됨 (REVOKED)" : selected?.status === "EXPIRED" ? "동의 만료됨 (EXPIRED)" : "동의 대기";
    setPatientStatus(label);

    if (quickApproveBtn) quickApproveBtn.style.display = "inline-flex";
    if (quickRevokeBtn) quickRevokeBtn.style.display = "none";
    if (actionConsentBadge) {
      actionConsentBadge.textContent = label;
      actionConsentBadge.className = selected?.status === "REVOKED" ? "status red" : selected?.status === "EXPIRED" ? "status amber" : "status teal";
    }
    if (actionConsentDesc) {
      actionConsentDesc.textContent = `${selectedStudy?.description || "의료영상"}의 받는 병원과 범위를 확인하고 동의해 주세요.`;
    }
  }

  renderActiveTransferCard(active);
  updateHospitalSaaSState(active, consents);
}

function clinicianHospitalLabel(value) {
  const raw = String(value ?? '').trim();
  const known = { 'HOSP-A': 'A대학병원', 'HOSP-B': 'B대학병원', 'HOSP-C': 'C대학병원' };
  if (known[raw]) return known[raw];
  return /^HOSP-[A-Z0-9-]+$/i.test(raw) ? '병원 확인 필요' : raw || '병원 확인 필요';
}

function clinicianPurposeLabel(value) {
  const known = { TREATMENT: '진료', TRANSFER: '전원', CONSULTATION: '진료 상담', RESEARCH: '연구' };
  return clinicianConsentLabel(value, known, '공유 목적 확인 필요');
}

function clinicianPermissionLabel(value) {
  const known = { VIEW_ONLY: '영상 열람만', DOWNLOAD_ALLOWED: '열람·다운로드 허용' };
  return clinicianConsentLabel(value, known, '허용 범위 확인 필요');
}

function clinicianConsentLabel(value, known, fallback) {
  const raw = String(value ?? '').trim();
  if (known[raw]) return known[raw];
  return /^[A-Z][A-Z0-9_]{2,}$/.test(raw) ? fallback : raw || fallback;
}

function updateHospitalSaaSState(activeConsent, consents) {
  refreshClinicianHome();
  const patientHeading = document.querySelector('#home-selected-name');
  if (patientHeading) patientHeading.textContent = demo.patientName || demo.patientId;
  const sourceHeading = document.querySelector('#home-selected-source');
  if (sourceHeading) sourceHeading.textContent = `${clinicianHospitalLabel(activeConsent?.sourceHospitalId || demo.sourceHospitalId)} → ${clinicianHospitalLabel(activeConsent?.targetHospitalId || demo.targetHospitalId)}`;
  const studyHeading = document.querySelector('#home-selected-study');
  if (studyHeading) studyHeading.textContent = selectedStudy?.description || '공유받은 영상';
  // 1. Dashboard Metric Cards
  const metricStatus = document.querySelector("#saas-metric-consent-status");
  const metricSub = document.querySelector("#saas-metric-consent-sub");

  if (metricStatus) {
    if (activeConsent) {
      metricStatus.textContent = "동의 유효";
      metricStatus.style.color = "#16a34a";
    } else {
      metricStatus.textContent = "확인 필요";
      metricStatus.style.color = "#d97706";
    }
  }
  if (metricSub) {
    if (activeConsent) {
      metricSub.textContent = "환자 동의는 유효합니다. 영상 열람 전 서버가 권한을 다시 확인합니다.";
    } else {
      metricSub.textContent = "환자 승인과 영상 접근 권한을 확인해야 합니다.";
    }
  }

  // 2. Recent Exchanges Table
  const recentTable = document.querySelector("#saas-recent-exchange-rows");
  if (recentTable) {
    if (activeConsent) {
      recentTable.innerHTML = `
        <tr>
          <td data-label="환자 번호"><strong>${escapeHtml(demo.patientId)}</strong></td>
          <td data-label="보낸 병원">${escapeHtml(clinicianHospitalLabel(activeConsent.sourceHospitalId || demo.sourceHospitalId))}</td>
          <td data-label="받는 병원">${escapeHtml(clinicianHospitalLabel(activeConsent.targetHospitalId || demo.targetHospitalId))}</td>
          <td data-label="공유 목적">${escapeHtml(clinicianPurposeLabel(activeConsent.purpose || demo.purpose))}</td>
          <td data-label="허용 범위">${escapeHtml(clinicianPermissionLabel(activeConsent.permission || demo.permission))}</td>
          <td data-label="동의 상태"><span class="mq-badge mq-badge-good">동의 유효</span><small class="clinical-status-hint">열람 전 서버 재검증</small></td>
          <td data-label="다음 행동"><button class="mq-btn small mq-btn-primary" type="button" data-view-jump="exchange">공유 상태 보기</button></td>
        </tr>
      `;
    } else {
      const selected = getConsentForStudy(selectedStudyUid, consents);
      const revokedConsent = selected?.status === "REVOKED" ? selected : null;
      const statusBadge = revokedConsent
        ? '<span class="mq-badge mq-badge-bad">공유 중단됨</span>'
        : '<span class="mq-badge mq-badge-warn">동의 확인 필요</span>';

      recentTable.innerHTML = `
        <tr>
          <td data-label="환자 번호"><strong>${escapeHtml(demo.patientId)}</strong></td>
          <td data-label="보낸 병원">${escapeHtml(clinicianHospitalLabel(demo.sourceHospitalId))}</td>
          <td data-label="받는 병원">${escapeHtml(clinicianHospitalLabel(demo.targetHospitalId))}</td>
          <td data-label="공유 목적">${escapeHtml(clinicianPurposeLabel(demo.purpose))}</td>
          <td data-label="허용 범위">${escapeHtml(clinicianPermissionLabel(demo.permission))}</td>
          <td data-label="동의 상태">${statusBadge}</td>
          <td data-label="다음 행동"><button class="mq-btn small" type="button" data-view-jump="exchange">공유 상태 보기</button></td>
        </tr>
      `;
    }

    recentTable.querySelectorAll("[data-view-jump]").forEach((btn) => {
      btn.addEventListener("click", () => navigateHospitalScreen(btn.dataset.viewJump));
    });
  }

  // 3. Exchange Screen Cards
  const consentBadge = document.querySelector("#exchange-consent-badge");
  const consentIdEl = document.querySelector("#exchange-consent-id");
  const consentScopeEl = document.querySelector("#exchange-consent-scope");
  const consentExpiryEl = document.querySelector("#exchange-consent-expiry");
  const authBadge = document.querySelector("#exchange-auth-badge");
  const authDecisionEl = document.querySelector("#exchange-auth-decision");
  const tokenStatusEl = document.querySelector("#exchange-token-status");
  const doctorTokenNotice = document.querySelector("#doctor-token-notice");
  const step1Label = document.querySelector("#pipeline-step1-label");
  const step2Label = document.querySelector("#pipeline-step2-label");
  const step3Label = document.querySelector("#pipeline-step3-label");

  if (activeConsent) {
    if (consentBadge) {
      consentBadge.textContent = "ACTIVE (승인됨)";
      consentBadge.className = "mq-badge mq-badge-good";
    }
    if (consentIdEl) consentIdEl.textContent = activeConsent.consentId;
    if (consentScopeEl) consentScopeEl.textContent = `${activeConsent.purpose || demo.purpose} / ${activeConsent.permission || demo.permission}`;
    if (consentExpiryEl) consentExpiryEl.textContent = `${formatDate(activeConsent.validUntil)} 까지`;
    if (step1Label) step1Label.textContent = "동의 승인됨 (ACTIVE)";

    if (latestToken) {
      if (authBadge) {
        authBadge.textContent = "ONLINE (발급됨)";
        authBadge.className = "mq-badge mq-badge-good";
      }
      if (authDecisionEl) authDecisionEl.textContent = "ALLOWED (ABAC 통과)";
      if (tokenStatusEl) tokenStatusEl.textContent = "발급 완료 · 단기 접근 권한";
      if (step2Label) step2Label.textContent = "검증 통과 (ALLOWED)";
      if (step3Label) step3Label.textContent = "5분 토큰 발급됨";
      if (doctorTokenNotice) {
        doctorTokenNotice.textContent = "단기 접근토큰(5분)이 발급되어 Gateway를 통해 안전하게 DICOM 영상을 열람할 수 있습니다.";
        doctorTokenNotice.style.background = "#e8f5ed";
        doctorTokenNotice.style.color = "#166534";
        doctorTokenNotice.style.borderColor = "#c6e7d1";
      }
    } else {
      if (authBadge) {
        authBadge.textContent = "READY (검증 가능)";
        authBadge.className = "mq-badge mq-badge-good";
      }
      if (authDecisionEl) authDecisionEl.textContent = "CONSENT_READY (발급 대기)";
      if (tokenStatusEl) tokenStatusEl.textContent = "미발급 (대기)";
      if (step2Label) step2Label.textContent = "검증 준비 (READY)";
      if (step3Label) step3Label.textContent = "미발급 (대기)";
      if (doctorTokenNotice) {
        doctorTokenNotice.textContent = "환자 동의가 승인되었습니다. [단기 DICOMweb 토큰 발급 요청] 버튼을 눌러 영상 열람을 시작하세요.";
        doctorTokenNotice.style.background = "#e0f2fe";
        doctorTokenNotice.style.color = "#0369a1";
        doctorTokenNotice.style.borderColor = "#bae6fd";
      }
    }
  } else {
    const selected = getConsentForStudy(selectedStudyUid, consents);
    const revoked = selected?.status === "REVOKED" ? selected : null;
    if (consentBadge) {
      if (revoked) {
        consentBadge.textContent = "REVOKED (철회됨)";
        consentBadge.className = "mq-badge mq-badge-bad";
      } else {
        consentBadge.textContent = "대기 (PENDING)";
        consentBadge.className = "mq-badge mq-badge-warn";
      }
    }
    if (consentIdEl) consentIdEl.textContent = revoked ? revoked.consentId : "-";
    if (consentScopeEl) consentScopeEl.textContent = `${demo.purpose} / ${demo.permission}`;
    if (consentExpiryEl) consentExpiryEl.textContent = revoked ? "동의 철회됨" : "미승인 (대기)";
    if (step1Label) step1Label.textContent = revoked ? "Consent REVOKED" : "Consent PENDING";

    if (authBadge) {
      authBadge.textContent = revoked ? "REVOKED" : "대기 (동의 필요)";
      authBadge.className = "mq-badge mq-badge-warn";
    }
    if (authDecisionEl) authDecisionEl.textContent = revoked ? "CONSENT_REVOKED" : "PATIENT_CONSENT_REQUIRED";
    if (tokenStatusEl) tokenStatusEl.textContent = "미발급 (대기)";
    if (step2Label) step2Label.textContent = "RBAC + ABAC";
    if (step3Label) step3Label.textContent = "5분 유효 Token";

    if (doctorTokenNotice) {
      if (revoked) {
        doctorTokenNotice.textContent = "환자가 동의를 철회하였습니다. 신규 토큰 발급 및 영상 접근이 차단됩니다.";
        doctorTokenNotice.style.background = "#fcebea";
        doctorTokenNotice.style.color = "#991b1b";
        doctorTokenNotice.style.borderColor = "#fecaca";
      } else {
        doctorTokenNotice.textContent = "환자 동의가 대기 상태입니다. 환자 포털에서 동의를 승인한 후 토큰 발급을 요청하세요.";
        doctorTokenNotice.style.background = "#fffbeb";
        doctorTokenNotice.style.color = "#92400e";
        doctorTokenNotice.style.borderColor = "#fde68a";
      }
    }
  }
}

async function createPatientConsent(options = {}) {
  if (consentMutationPending) return { error: "CONSENT_OPERATION_IN_PROGRESS" };
  if (!shareReview?.allowed()) { showToast('공유 내용을 확인하고 확인란을 선택해 주세요.'); return {error:'CONSENT_REVIEW_REQUIRED'}; }
  consentMutationPending = true;
  updateConsentOperationControls();
  let acknowledgedConsent = null;
  try {
  consentViewRevision++;
  patientConsentReady = false;
  updateVisitModePacket(null);
  clearCountdownTimer();
  latestTicketNonce = null;
  syncPatientChoices({ preserveConsentState: true });
  setPatientStatus("동의 생성 중");
  const scope = { studyInstanceUid: selectedStudyUid };
  if (selectedSeriesUid) scope.seriesInstanceUid = selectedSeriesUid;

  const result = await postJson("/api/consents", {
    ...demo,
    studyInstanceUid: selectedStudyUid,
    seriesInstanceUid: selectedSeriesUid || undefined,
    validFrom: toIsoFromLocal(consentValidFromInput.value),
    validUntil: toIsoFromLocal(consentValidUntilInput.value),
    scopes: [scope],
    healthRecordIds: healthSharePicker?.ids()??[],
  });

  consentViewRevision++;
  if (result.consentId) {
    if (result.status === "ACTIVE") acknowledgedConsent = { consentId: result.consentId, status: result.status };
    latestConsentId = result.consentId;
    if (typeof lastConsents !== 'undefined' && Array.isArray(lastConsents)) {
      lastConsents=[result,...lastConsents.filter(c=>c.consentId!==result.consentId)];
    }
    patientConsentReady = true;
    setPatientStatus("동의 완료 (ACTIVE)");
    showViewerMessage("환자 동의가 성공적으로 생성되었습니다.", "success");

    try {
      const handoff = await postJson(`/api/consents/${encodeURIComponent(result.consentId)}/handoff-ticket`, {});
      if (handoff?.qr?.payload) {
        const match = handoff.qr.payload.match(/\/t\/([A-Za-z0-9_-]{22,128})$/);
        if (match) latestTicketNonce = match[1];
        updateVisitModePacket(handoff);
      }
    } catch {
      if (typeof patientQrController !== 'undefined') patientQrController.clear('공유는 승인됐지만 QR 발급에 실패했습니다. QR 발급 버튼으로 다시 시도해 주세요.');
    }
    broadcastSync("CONSENT_CREATED");
    if(!latestTicketNonce && typeof patientQrController !== 'undefined') patientQrController.clear('공유는 승인됐지만 QR 발급을 확인하지 못했습니다. 기존 QR가 있다면 해당 화면을 이용해 주세요.');
    navigatePatientPage("visit");
    showToast(latestTicketNonce ? "공유 동의가 생성되었습니다. 병원에 1회용 QR를 보여주세요." : "동의가 생성되었습니다. QR 발급 결과는 확인이 필요합니다.");
  } else {
    patientConsentReady = false;
    latestTicketNonce = null;
    setPatientStatus("동의 생성 실패");
    showViewerMessage(toFriendlyError(result.error), "fail");
  }

  updatePipelineSteps();
  if (!options.silent) renderOutput(result);
  await loadDashboard();
  return result;
  } catch {
    patientConsentReady = false;
    setPatientStatus(acknowledgedConsent ? "동의 생성 확인됨 · 화면 갱신 필요" : "동의 결과 확인 필요");
    const result = acknowledgedConsent
      ? { ...acknowledgedConsent, error: "CONSENT_REFRESH_FAILED" }
      : { error: "CONSENT_REQUEST_FAILED" };
    renderOutput(result);
    return result;
  } finally {
    consentMutationPending = false;
    consentViewRevision++;
    updateConsentOperationControls();
  }
}

async function revokePatientConsent() {
  if (consentMutationPending) return false;
  const requestedConsentId = latestConsentId;
  updateVisitModePacket(null);
  if (typeof requestedConsentId !== "string" || !requestedConsentId) {
    showViewerMessage("철회할 동의를 먼저 선택해 주세요.", "warning");
    return false;
  }
  consentMutationPending = true;
  updateConsentOperationControls();
  try {
  consentViewRevision++;
  patientConsentReady = false;
  clearCountdownTimer();
  latestToken = null;
  latestTokenInfo = null;
  latestTicketNonce = null;
  resetViewerData();
  setPatientStatus("동의 철회 확인 중");
  const result = await postJson(`/api/consents/${encodeURIComponent(requestedConsentId)}/revoke`, { actorId: demo.patientId });
  consentViewRevision++;
  clearCountdownTimer();
  latestToken = null;
  latestTokenInfo = null;
  latestTicketNonce = null;
  patientConsentReady = false;
  const acknowledged = isRevocationAcknowledged(result, requestedConsentId);
  setPatientStatus(acknowledged ? "동의 철회됨 (REVOKED)" : "철회 결과 확인 필요");
  if (viewerStatus) viewerStatus.textContent = "토큰 필요";
  resetViewerData();
  updatePipelineSteps();
  showViewerMessage(acknowledged ? "동의가 철회되었습니다. 기존 발급 토큰은 폐기됩니다." : "철회를 확인하지 못했습니다. 서버 동의 상태를 다시 확인해 주세요.", acknowledged ? "warning" : "fail");
  renderOutput(result);
  if (acknowledged) broadcastSync("CONSENT_REVOKED");
  await loadDashboard();
  return acknowledged;
  } catch {
    setPatientStatus("철회 결과 확인 필요");
    showViewerMessage("철회를 확인하지 못했습니다. 서버 상태를 다시 확인해 주세요.", "fail");
    return false;
  } finally {
    consentMutationPending = false;
    consentViewRevision++;
    updateConsentOperationControls();
  }
}

function updateConsentOperationControls() {
  patientSharing?.update(lastStudies, lastConsents, consentMutationPending);
  patientHistory?.update(lastStudies, lastConsents, consentMutationPending);
  for (const control of document.querySelectorAll("#patient-consent, #patient-revoke, #btn-quick-approve, #btn-quick-revoke, #btn-activity-revoke, #patient-study-select, #patient-series-select, #source-hospital-select, #target-hospital-select, #access-purpose-select, #access-mode-select, #consent-valid-from, #consent-valid-until")) control.disabled = consentMutationPending;
  const tokenButton = document.querySelector("#doctor-request-token");
  if (tokenButton) tokenButton.disabled = consentMutationPending || tokenRequestPending;
  const renewButton = document.querySelector("#studio-renew-access");
  if (renewButton) renewButton.disabled = consentMutationPending || tokenRequestPending;
  shareReview?.refresh(consentMutationPending);
}

function currentTokenRequestContext() {
  return JSON.stringify([consentViewRevision, latestConsentId, selectedStudyUid, selectedSeriesUid,
    demo.doctorId, demo.sourceHospitalId, demo.targetHospitalId, demo.purpose, demo.permission]);
}

function syncPatientChoices(options = {}) {
  if (sourceHospitalSelect) demo.sourceHospitalId = sourceHospitalSelect.value;
  if (targetHospitalSelect) demo.targetHospitalId = targetHospitalSelect.value;
  if (accessPurposeSelect) demo.purpose = accessPurposeSelect.value;
  if (accessModeSelect) demo.permission = accessModeSelect.value;
  if (patientSeriesSelect) selectedSeriesUid = patientSeriesSelect.value;

  latestToken = null;
  latestTokenInfo = null;
  resetViewerData();
  if (!options.preserveConsentState) {
    patientConsentReady = false;
    setPatientStatus("동의 필요");
  }
  if (viewerStatus) viewerStatus.textContent = "토큰 필요";
}

function applyPatientStudySnapshot(studies) {
  if (!Array.isArray(studies)) throw new Error('PATIENT_SNAPSHOT_UNAVAILABLE');
  lastStudies = studies;
  patientStudySnapshotAvailable = true;
  renderPatientStudyOptions(lastStudies);
  renderStudies(lastStudies);
  shareReview?.refresh(consentMutationPending);
}

function renderPatientStudyOptions(studies) {
  if (!patientStudySelect) return;
  patientStudySelect.innerHTML = studies.map((study) => `
    <option value="${escapeHtml(study.studyInstanceUid)}">${escapeHtml(study.description)} (${escapeHtml(study.modality)})</option>
  `).join("") || '<option value="">등록된 영상검사가 없습니다</option>';

  if (!studies.some((study) => study.studyInstanceUid === selectedStudyUid)) {
    selectedStudyUid = studies[0]?.studyInstanceUid || '';
    selectedSeriesUid = '';
  }
  patientStudySelect.disabled = consentMutationPending || !studies.length;
  patientStudySelect.value = selectedStudyUid;
  const selected = studies.find(study => study.studyInstanceUid === selectedStudyUid);
  if (selected && sourceHospitalSelect) {
    sourceHospitalSelect.value = selected.sourceHospitalId;
    demo.sourceHospitalId = selected.sourceHospitalId;
  }
  // Never overwrite the recipient, purpose, permission or dates of a draft.
  const state = document.querySelector('#share-study-state');
  if (state) { state.textContent = studies.length ? `등록된 영상검사 ${studies.length}건에서 선택하세요.` : '등록된 영상검사가 없습니다. 기록을 다시 불러와 주세요.'; state.dataset.state = studies.length ? 'ready' : 'empty'; }
  renderPatientSeriesOptions();
}

function renderPatientSeriesOptions() {
  if (!patientSeriesSelect) return;
  const study = lastStudies.find((item) => item.studyInstanceUid === selectedStudyUid);
  const seriesRows = study?.series ?? [];
  patientSeriesSelect.innerHTML = [
    `<option value="">Study 전체</option>`,
    ...seriesRows.map((series) => `
      <option value="${escapeHtml(series.seriesInstanceUid)}">${escapeHtml(series.description)} / ${escapeHtml(series.seriesInstanceUid)}</option>
    `),
  ].join("");

  if (selectedSeriesUid && !seriesRows.some((series) => series.seriesInstanceUid === selectedSeriesUid)) {
    selectedSeriesUid = "";
  }
  patientSeriesSelect.value = selectedSeriesUid;
}

function renderConsentHistory(consents) {
  const container = document.querySelector("#patient-consent-history");
  if (!container) return;
  if (!consents.length) {
    container.innerHTML = '<div class="notice">생성된 동의 이력이 없습니다.</div>';
    return;
  }

  container.innerHTML = consents.slice(0, 8).map((consent) => {
    const isAct = consent.status === "ACTIVE";
    const statusClass = isAct ? "status green" : (consent.status === "REVOKED" ? "status red" : "status amber");
    return `
      <div class="action-card">
        <div class="action-symbol" style="--soft:${isAct ? '#e8f5ed' : '#fcebea'};--tone:${isAct ? '#2b7d55' : '#b13b38'}">
          ${isAct ? '✓' : '✕'}
        </div>
        <div>
          <h3>${escapeHtml(consent.sourceHospitalId)} → ${escapeHtml(consent.targetHospitalId)}</h3>
          <p>${escapeHtml(consent.purpose)} · ${escapeHtml(consent.permission)} · 만료: ${escapeHtml(formatDate(consent.validUntil))}</p>
        </div>
        <span class="${statusClass}">${escapeHtml(consent.status)}</span>
      </div>
    `;
  }).join("");
}

// --------------------------------------------------------------------------
// Doctor Access & Token Operations
// --------------------------------------------------------------------------
async function renewViewerAccess() {
  if (currentPersona !== "DOCTOR" || consentMutationPending || tokenRequestPending) return;
  const resume = { studyUid:selectedStudyUid, seriesUid:selectedSeriesUid, sopUid:selectedSopUid, index:currentSliceIndex };
  // Keep only navigation position, never expired pixels or a reusable credential.
  clearCountdownTimer();
  hideSeriesImage();
  latestToken = null;
  latestTokenInfo = null;
  setDownloadState();
  return requestDoctorToken({ resume });
}

async function requestDoctorToken(options = {}) {
  if (consentMutationPending || tokenRequestPending) {
    return { decision: "DENIED", reasonCode: "CONSENT_OPERATION_IN_PROGRESS" };
  }
  if (!patientConsentReady) {
    latestToken = null;
    latestTokenInfo = null;
    if (viewerStatus) viewerStatus.textContent = "Consent required";
    const denied = { decision: "DENIED", reasonCode: "PATIENT_CONSENT_REQUIRED" };
    showViewerMessage(toFriendlyError(denied.reasonCode), "fail");
    renderOutput(denied);
    return denied;
  }

  const requestedContext = currentTokenRequestContext();
  tokenRequestPending = true;
  updateConsentOperationControls();
  try {
  const result = await postJson("/api/dicom-access/request", {
    consentId: latestConsentId,
    doctorId: demo.doctorId,
    requestingHospitalId: demo.targetHospitalId,
    studyInstanceUid: selectedStudyUid,
    seriesInstanceUid: selectedSeriesUid || undefined,
    purpose: demo.purpose,
    requestedAction: "VIEW",
  });

  if (consentMutationPending || !patientConsentReady || requestedContext !== currentTokenRequestContext()) {
    return { decision: "DENIED", reasonCode: "VIEW_CONTEXT_CHANGED" };
  }
  if (result.decision === "ALLOWED") {
    latestToken = result.accessToken;
    latestTokenInfo = result;
    if (viewerStatus) viewerStatus.textContent = "토큰 발급됨 (ONLINE)";
    setDownloadState();
    showViewerMessage("단기 토큰이 발급되었습니다. 필요할 때만 Series와 Instance를 순차적으로 불러옵니다.", "success");
    startCountdownTimer(result.expiresAt);
    updateWatermark(result);
    updatePipelineSteps();
    broadcastSync("TOKEN_ISSUED");

    await loadGatewayStudies();
    if (consentMutationPending || requestedContext !== currentTokenRequestContext() || latestToken !== result.accessToken) return { decision: "DENIED", reasonCode: "VIEW_CONTEXT_CHANGED" };
    await loadSeriesForActiveToken();
    if (consentMutationPending || latestToken !== result.accessToken) return { decision: "DENIED", reasonCode: "VIEW_CONTEXT_CHANGED" };
    if (lastSeries.length > 0) {
      await loadInstancesForSelectedSeries(options);
    }
  } else {
    latestToken = null;
    latestTokenInfo = null;
    if (viewerStatus) viewerStatus.textContent = "접근 거부";
    showViewerMessage(toFriendlyError(result.reasonCode), "fail");
  }

  renderOutput(result);
  await loadDashboard();
  return result;
  } catch {
    if (requestedContext === currentTokenRequestContext()) {
      latestToken = null;
      latestTokenInfo = null;
      resetViewerData();
    }
    showViewerMessage("접근 요청을 완료하지 못했습니다. 서버 상태와 동의를 확인해 주세요.", "fail");
    return { decision: "DENIED", reasonCode: "TOKEN_REQUEST_FAILED" };
  } finally {
    tokenRequestPending = false;
    updateConsentOperationControls();
  }
}

async function openViewer() {
  if(currentPersona!=="DOCTOR")switchPersona("DOCTOR");
  navigateHospitalScreen("viewer");
  if (!latestToken || latestTokenInfo?.studyInstanceUid !== selectedStudyUid) {
    await requestDoctorToken();
  } else {
    await loadGatewayStudies();
    await loadSeriesForActiveToken();
    if (lastSeries.length > 0) {
      await loadInstancesForSelectedSeries();
    }
  }
}

async function loadGatewayStudies() {
  if (!requireToken()) return;
  const result = await getJson("/dicomweb/studies", latestToken);
  renderOutput(result);
  if (!Array.isArray(result)) {
    showViewerMessage(toFriendlyError(result.error), "fail");
    return;
  }
  showViewerMessage(`Study 메타데이터 ${result.length}건을 확인했습니다. Series는 온디맨드로 지연 로딩됩니다.`, "success");
}

async function loadSeriesForActiveToken() {
  if (!requireToken()) return;
  const result = await getJson(`/dicomweb/studies/${selectedStudyUid}/series`, latestToken);
  renderOutput(result);
  if (!Array.isArray(result)) {
    lastSeries = [];
    renderSeries([]);
    showViewerMessage(toFriendlyError(result.error), "fail");
    return;
  }
  lastSeries = result;
  renderSeries(result);
  if (viewerStatus) viewerStatus.textContent = "Series ready";
  showViewerMessage("Series 메타데이터를 불러왔습니다. Series를 선택하여 Instance를 스트리밍하세요.", "success");
}

async function loadInstancesForSelectedSeries(options = {}) {
  if (!requireToken()) return;
  if (!selectedSeriesUid && lastSeries.length > 0) {
    const firstUid = dicomValue(lastSeries[0], "0020000E");
    if (firstUid) {
      selectedSeriesUid = firstUid;
      hideSeriesImage();
    }
  }
  if (!selectedSeriesUid) {
    showViewerMessage("Instance를 불러오기 전에 Series를 먼저 선택하세요.", "warning");
    return;
  }
  stopCinePlayback();
  clearSliceBlobCache();

  const requestedToken = latestToken;
  const requestedContext = currentTokenRequestContext();
  const result = await getJson(`/dicomweb/studies/${selectedStudyUid}/series/${selectedSeriesUid}/instances`, requestedToken);
  if (requestedToken !== latestToken || requestedContext !== currentTokenRequestContext() || !patientConsentReady || consentMutationPending) return;
  renderOutput(result);
  if (!Array.isArray(result) || result.length === 0) {
    lastInstances = [];
    totalSlices = 1;
    currentSliceIndex = 0;
    updateSliceControlsUi();
    renderTransferSelection();
    showViewerMessage(toFriendlyError(result?.error || "NO_INSTANCES"), "fail");
    return;
  }

  // Sort instances by InstanceNumber ascending
  lastInstances = result.sort((a, b) => {
    const na = Number(dicomValue(a, "00200013") || 0);
    const nb = Number(dicomValue(b, "00200013") || 0);
    return na - nb;
  });

  totalSlices = lastInstances.length;
  currentSliceIndex = 0;
  const resume = options.resume;
  if (resume?.studyUid === selectedStudyUid && resume.seriesUid === selectedSeriesUid) {
    const previous = lastInstances.findIndex(row => dicomValue(row, "00080018") === resume.sopUid);
    currentSliceIndex = previous >= 0 ? previous : Math.max(0, Math.min(totalSlices - 1, Number.isInteger(resume.index) ? resume.index : 0));
  }
  updateSliceControlsUi();
  renderTransferSelection();
  showViewerMessage(`Instance 메타데이터 ${totalSlices}건을 확인했습니다. 마우스 휠 또는 Cine 재생으로 단면을 탐색하세요.`, "success");

  await displaySlice(currentSliceIndex);
}

function updateSliceControlsUi() {
  const slider = document.querySelector("#viewer-slice-slider");
  const badge = document.querySelector("#viewer-slice-indicator");
  const hudSlice = document.querySelector("#viewer-slice-hud");
  const hudStudy = document.querySelector("#viewer-hud-study");
  const btnPrev = document.querySelector("#btn-prev-slice");
  const btnNext = document.querySelector("#btn-next-slice");

  if (slider) {
    slider.min = "1";
    slider.max = String(Math.max(1, totalSlices));
    slider.value = String(currentSliceIndex + 1);
    slider.disabled = totalSlices <= 1;
  }
  if (badge) badge.textContent = lastInstances.length ? `${currentSliceIndex + 1} / ${totalSlices}` : '—';
  if (hudSlice) hudSlice.textContent = lastInstances.length ? `${currentSliceIndex + 1} / ${totalSlices}` : '—';
  if (hudStudy) {
    const desc = selectedStudy?.description || "Study";
    const mod = selectedStudy?.modality || "DICOM";
    hudStudy.textContent = `${desc} (${mod})`;
  }
  if (btnPrev) btnPrev.disabled = totalSlices <= 1;
  if (btnNext) btnNext.disabled = totalSlices <= 1;
}

async function displaySlice(index, options = {}) {
  if (consentMutationPending || !latestToken) return;
  const requestedToken = latestToken;
  const requestedContext = currentTokenRequestContext();
  if (!lastInstances || lastInstances.length === 0) return;
  if (index < 0 || index >= lastInstances.length) return;

  currentSliceIndex = index;
  updateSliceControlsUi();

  const instance = lastInstances[index];
  const sopInstanceUid = dicomValue(instance, "00080018") || "";
  selectedSopUid = sopInstanceUid;
  setDownloadState();

  if (instanceDetail) {
    instanceDetail.hidden = false;
    instanceDetail.textContent = `SOP ${sopInstanceUid.slice(0, 24)}... (단면 ${index + 1}/${totalSlices})`;
  }
  if (viewerStatus) viewerStatus.textContent = `Slice ${index + 1}/${totalSlices}`;

  // 1. Check LRU Cache
  if (sliceBlobCache.has(sopInstanceUid)) {
    const cachedUrl = sliceBlobCache.get(sopInstanceUid);
    showSeriesImage(cachedUrl, `Slice ${index + 1}`);
    if (!options.isCine) prefetchAdjacentSlices(index);
    return;
  }

  // 2. Fetch rendered slice
  if (!latestToken) return;
  try {
    const renderedUrl = `/dicomweb/studies/${selectedStudyUid}/series/${selectedSeriesUid}/instances/${sopInstanceUid}/rendered`;
    const response = await proofFetch(renderedUrl, {
      headers: { authorization: `Bearer ${latestToken}` },
    });

    if (response.ok) {
      const blob = await response.blob();
      if (consentMutationPending || latestToken !== requestedToken || requestedContext !== currentTokenRequestContext()) return;
      const blobUrl = URL.createObjectURL(blob);
      if (sliceBlobCache.size >= 40) {
        const oldestKey = sliceBlobCache.keys().next().value;
        const oldUrl = sliceBlobCache.get(oldestKey);
        try { URL.revokeObjectURL(oldUrl); } catch {}
        sliceBlobCache.delete(oldestKey);
      }
      sliceBlobCache.set(sopInstanceUid, blobUrl);

      if (currentSliceIndex === index) {
        showSeriesImage(blobUrl, `Slice ${index + 1}`);
      }
    } else {
      clearSliceBlobCache();
      hideSeriesImage();
      showViewerMessage("영상 접근을 확인할 수 없습니다. 예제 이미지로 대체하지 않습니다.", "fail");
      return;
    }
  } catch {
    clearSliceBlobCache();
    hideSeriesImage();
    showViewerMessage("영상 조회에 실패했습니다. 승인된 연결을 다시 확인해 주세요.", "fail");
    return;
  }

  if (!options.isCine) {
    prefetchAdjacentSlices(index);
  }
}

function stepSlice(delta) {
  if (totalSlices <= 1) return;
  let next = currentSliceIndex + delta;
  if (next < 0) next = totalSlices - 1;
  else if (next >= totalSlices) next = 0;
  displaySlice(next);
}

let prefetching = false;
async function prefetchAdjacentSlices(currentIndex) {
  if (prefetching || !latestToken || totalSlices <= 1) return;
  const requestedToken = latestToken;
  const requestedContext = currentTokenRequestContext();
  prefetching = true;
  try {
    const targets = [currentIndex + 1, currentIndex + 2, currentIndex - 1].filter(
      (i) => i >= 0 && i < totalSlices
    );
    for (const idx of targets) {
      const inst = lastInstances[idx];
      if (!inst) continue;
      const sop = dicomValue(inst, "00080018");
      if (!sop || sliceBlobCache.has(sop)) continue;

      const res = await proofFetch(`/dicomweb/studies/${selectedStudyUid}/series/${selectedSeriesUid}/instances/${sop}/rendered`, {
        headers: { authorization: `Bearer ${latestToken}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        if (consentMutationPending || latestToken !== requestedToken || requestedContext !== currentTokenRequestContext()) return;
        const url = URL.createObjectURL(blob);
        if (sliceBlobCache.size >= 40) {
          const oldestKey = sliceBlobCache.keys().next().value;
          const oldUrl = sliceBlobCache.get(oldestKey);
          try { URL.revokeObjectURL(oldUrl); } catch {}
          sliceBlobCache.delete(oldestKey);
        }
        sliceBlobCache.set(sop, url);
      }
    }
  } catch {} finally {
    prefetching = false;
  }
}

function toggleCinePlayback() {
  if (isCinePlaying) {
    stopCinePlayback();
  } else {
    startCinePlayback();
  }
}

function startCinePlayback() {
  if (totalSlices <= 1 || !latestToken) {
    showViewerMessage("Cine 재생을 위해서는 2개 이상의 Instance가 필요합니다.", "info");
    return;
  }
  isCinePlaying = true;
  const btn = document.querySelector("#tool-cine-play");
  if (btn) {
    btn.textContent = "일시 정지";
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add("active");
  }

  const intervalMs = Math.round(1000 / cineFps);
  cineIntervalId = setInterval(() => {
    if (!latestToken || totalSlices <= 1) {
      stopCinePlayback();
      return;
    }
    const next = (currentSliceIndex + 1) % totalSlices;
    displaySlice(next, { isCine: true });
  }, intervalMs);
}

function stopCinePlayback() {
  if (cineIntervalId) {
    clearInterval(cineIntervalId);
    cineIntervalId = null;
  }
  isCinePlaying = false;
  const btn = document.querySelector("#tool-cine-play");
  if (btn) {
    btn.textContent = "재생";
    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove("active");
  }
}

function cycleCineFps() {
  const speeds = [10, 15, 24, 30];
  const nextIdx = (speeds.indexOf(cineFps) + 1) % speeds.length;
  cineFps = speeds[nextIdx];
  const btn = document.querySelector("#tool-cine-fps");
  if (btn) btn.textContent = `${cineFps} fps`;
  if (isCinePlaying) {
    stopCinePlayback();
    startCinePlayback();
  }
}

function clearSliceBlobCache() {
  for (const url of sliceBlobCache.values()) {
    try { URL.revokeObjectURL(url); } catch {}
  }
  sliceBlobCache.clear();
}

async function loadInstancePixels(sopInstanceUid) {
  if (!requireToken()) return;
  const targetIdx = lastInstances.findIndex((inst) => dicomValue(inst, "00080018") === sopInstanceUid);
  if (targetIdx >= 0) {
    await displaySlice(targetIdx);
  } else {
    selectedSopUid = sopInstanceUid;
    setDownloadState();
  }
}

async function downloadSelectedInstance() {
  showViewerMessage('PC 다운로드는 차단되어 있습니다. B병원 PACS 보관을 이용해 주세요.','warning');
}

function stageSelectedInstanceForPacs(){
  if(pacsImportBusy||activeTransferJobId){navigateHospitalScreen('transfer');return;}
  const consent=getConsentForStudy(selectedStudyUid,lastConsents);
  const item={studyInstanceUid:selectedStudyUid,seriesInstanceUid:selectedSeriesUid,sopInstanceUid:selectedSopUid};
  if(!item.sopInstanceUid||!importPreflight(consent,{...item,hospitalId:demo.targetHospitalId}).ready){showToast('선택 영상과 다운로드 동의를 확인하세요.');return;}
  if(transferQueue.length){showToast('기존 선택 작업을 먼저 확인하세요. 다른 영상을 자동으로 추가하지 않습니다.');navigateHospitalScreen('transfer');return;}
  transferQueue.push(item);transferQueueConsentId=consent.consentId;
  navigateHospitalScreen('transfer');renderTransferSelection();runPreflightCheck();
}

function renderSeries(seriesRows) {
  const container = document.querySelector("#viewer-series-list");
  if (!container) return;
  const count = document.querySelector('#studio-series-count');
  if (count) count.textContent = `${seriesRows.length}개`;

  if (!seriesRows.length) {
    container.innerHTML = '<div style="font-size:11px;color:#94a3b8;">조회 가능한 Series가 없습니다.</div>';
    hideSeriesImage();
    return;
  }

  const activeUid = seriesRows.some(row => dicomValue(row, "0020000E") === selectedSeriesUid)
    ? selectedSeriesUid : dicomValue(seriesRows[0], "0020000E");
  container.innerHTML = seriesRows.map((series, index) => {
    const seriesUid = dicomValue(series, "0020000E");
    const description = dicomValue(series, "0008103E") || "Series";
    return `
      <button type="button" class="mq-thumb ${seriesUid === activeUid ? "selected" : ""}" aria-pressed="${seriesUid === activeUid}" data-viewer-series-uid="${escapeHtml(seriesUid)}">
        <img class="hp-series-preview" alt="승인된 Series 단면 미리보기" hidden>
        <strong>${index + 1}. ${escapeHtml(description)}</strong>
        <span class="studio-series-meta">시리즈 ${index + 1} · ${escapeHtml(dicomValue(series, "00080060") || 'DICOM')}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-viewer-series-uid]").forEach((thumb, index) => {
    thumb.addEventListener("click", async () => {
      container.querySelectorAll(".mq-thumb").forEach((t) => { t.classList.remove("selected"); t.setAttribute('aria-pressed','false'); });
      thumb.classList.add("selected");
      thumb.setAttribute('aria-pressed','true');
      selectedSeriesUid = thumb.dataset.viewerSeriesUid;
      selectedSopUid = "";
      hideSeriesImage();
      await loadInstancesForSelectedSeries();
    });
  });

  const firstUid = activeUid;
  if (firstUid) {
    selectedSeriesUid = firstUid;
    hideSeriesImage();
  } else {
    hideSeriesImage();
  }
}

// --------------------------------------------------------------------------
// Studies & Views Rendering
// --------------------------------------------------------------------------
function renderStudies(studies) {
  if (!patientHealth) patientHealth = createPatientHealth({root:document.querySelector('#patient-health-records'),
    patientName:()=>capstoneAuth?.context?.patientName||demo.patientName,onHome:()=>navigatePatientPage('home'),onSharing:()=>navigatePatientPage('sharing'),onRequests:()=>navigatePatientPage('activity'),
    onCompare:label=>{navigatePatientPage('helper');patientHelper?.selectMetric(label);},
    onView: study => openPatientStudyViewer(study.studyInstanceUid),
    onShare: study => { selectStudy(study.studyInstanceUid, lastStudies); if (sourceHospitalSelect) sourceHospitalSelect.value=study.sourceHospitalId;
      syncPatientChoices({preserveConsentState:true}); navigatePatientPage('consent'); },
    openPreview:(study,signal)=>{if(!capstoneAuth)throw new Error('PATIENT_VIEWER_DENIED');return createPatientPixelSession({patientId:demo.patientId,study,headers:capstoneAuth.headers('PATIENT'),signal});}});
  patientHealth?.update(studies, Boolean(capstoneAuth?.context.scenario),syntheticHealthClient?.records()??[]);
  if(currentPersona==='PATIENT')void syntheticHealthClient?.load();
  patientHealth?.setActive(currentPersona==='PATIENT'&&!document.querySelector('#patient-phr')?.hidden);
  if (!patientLibrary) patientLibrary = createPatientLibrary({root:document.querySelector('#studies'),
    onView: study => openPatientStudyViewer(study.studyInstanceUid),
    onShare: study => { selectStudy(study.studyInstanceUid, lastStudies);
      if (sourceHospitalSelect) sourceHospitalSelect.value = study.sourceHospitalId;
      syncPatientChoices({ preserveConsentState: true }); navigatePatientPage('consent'); },
    openPreview: (study, signal) => { if (!capstoneAuth) throw new Error('PATIENT_VIEWER_DENIED');
      return createPatientPixelSession({patientId:demo.patientId, study, headers:capstoneAuth.headers('PATIENT'), signal}); }
  });
  selectedStudy = studies.find(study => study.studyInstanceUid === selectedStudyUid) ?? studies[0] ?? null;
  if (selectedStudy) selectedStudyUid = selectedStudy.studyInstanceUid;
  syncSelectedStudyUi();
  shareReview?.refresh();
  patientLibrary?.update(studies, lastConsents);
  patientSharing?.update(studies, lastConsents, consentMutationPending);
  patientLibrary?.setActive(currentPersona === 'PATIENT' && !document.querySelector('#patient-portal-app [data-page="images"]')?.hidden);
}

function renderDoctorStudies(studies) {
  refreshClinicianHome();
  const container = document.querySelector("#doctor-studies");
  if (!container) return;
  const selectedTitle = document.querySelector('#clinical-selected-title');
  if (selectedTitle) selectedTitle.textContent = studies.find(study => study.studyInstanceUid === selectedStudyUid)?.description || '검사를 선택하세요';
  renderClinicianDetail(document.querySelector('#clinician-study-detail'),
    studies.find(study => study.studyInstanceUid === selectedStudyUid),
    getConsentForStudy(selectedStudyUid, lastConsents));
  renderClinicalDossier(document.querySelector('#clinical-dossier'),
    studies.find(study => study.studyInstanceUid === selectedStudyUid),
    getConsentForStudy(selectedStudyUid, lastConsents), capstoneAuth?.context);
  refreshClinicalNextAction();
  renderClinicalActivity(document.querySelector('#desk-recent-activity'),clinicalRecentLogs,selectedStudyUid);
  const allStudies = studies;
  const consentForStudy = uid => getConsentForStudy(uid, lastConsents);
  renderClinicalMetrics(document.querySelector('#clinician-metrics'), allStudies, consentForStudy);
  studies = filterClinicalStudies(allStudies, document.querySelector('#clinician-search')?.value,
    document.querySelector('#clinician-filter')?.value || 'all', consentForStudy);
  const resultCount = document.querySelector('#clinician-result-count');
  if (resultCount) resultCount.textContent = `${allStudies.length}건 중 ${studies.length}건`;

  if (!studies.length) {
    container.innerHTML = '<div class="notice">검색 조건에 맞는 의료영상이 없습니다. 검색어와 동의 필터를 확인하세요.</div>';
    return;
  }

  renderClinicalStudyList(container, studies, selectedStudyUid, consentForStudy);


  container.querySelectorAll('[data-doctor-detail]').forEach((button) => {
    button.addEventListener('click', async () => {
      await selectStudy(button.dataset.doctorDetail, allStudies);
      renderDoctorStudies(allStudies);
      const selectedButton = [...container.querySelectorAll('[data-doctor-detail]')]
        .find(item => item.dataset.doctorDetail === selectedStudyUid);
      selectedButton?.focus();
    });
  });

}

function refreshClinicalNextAction() {
  const consent=getConsentForStudy(selectedStudyUid,lastConsents);
  const study=lastStudies.find(row=>row.studyInstanceUid===selectedStudyUid);
  const next=clinicalNextAction(study,consent,latestTokenInfo,Boolean(viewerImage && !viewerImage.hidden));
  const button=document.querySelector('#clinical-open-viewer');
  const note=document.querySelector('#desk-next-action-note');
  const tag=document.querySelector('#desk-consent-label');
  if (button) button.textContent=next.label;
  if (note) note.textContent=next.note;
  if (tag) {
    const value=clinicianDetailModel(study,consent)[2]?.[1] || '검사 선택 대기';
    tag.textContent=value==='동의 유효 · 서버 검증 필요'?'공유 동의 유효':value;
    tag.dataset.state=next.action==='viewer'?'ready':'attention';
  }
}

async function selectStudy(studyUid, studies = lastStudies) {
  const nextStudy = studies.find(study => study.studyInstanceUid === studyUid);
  if (!nextStudy) return;
  selectedStudyUid = studyUid;
  selectedStudy = nextStudy;
  if (sourceHospitalSelect) sourceHospitalSelect.value = nextStudy.sourceHospitalId;
  demo.sourceHospitalId = nextStudy.sourceHospitalId;
  selectedSeriesUid = "";
  if (patientStudySelect) patientStudySelect.value = selectedStudyUid;
  renderPatientSeriesOptions();
  latestToken = null;
  latestTokenInfo = null;
  resetViewerData();
  updateConsentState(lastConsents);
  if (viewerStatus) viewerStatus.textContent = "토큰 필요";
  syncSelectedStudyUi();
  shareReview?.refresh(consentMutationPending);
  refreshClinicianHome();
}

function refreshClinicianHome() {
  demoTools?.update();
  clinicianHome?.update({studies:lastStudies, selectedUid:selectedStudyUid,
    consentForStudy:uid=>getConsentForStudy(uid,lastConsents),
    context:{...capstoneAuth?.context,patientName:demo.patientName}, logs:clinicalRecentLogs});
}

async function openClinicianHomeViewer() {
  const consent=getConsentForStudy(selectedStudyUid,lastConsents);
  if (!consent || clinicianDetailModel(selectedStudy,consent)[2]?.[1] !== '동의 유효 · 서버 검증 필요') {
    await loadDashboard();
    return;
  }
  // The home action confirms the purpose shown for this selected consent.
  // Server policy still verifies purpose, hospital, scope and current consent.
  demo.purpose=consent.purpose;
  if (accessPurposeSelect) accessPurposeSelect.value=consent.purpose;
  consentViewRevision++;
  latestToken=null;
  latestTokenInfo=null;
  resetViewerData();
  await openViewer();
}

function syncSelectedStudyUi() {
  if (!selectedStudy) return;
  for (const [selector, value] of [
    ['#studio-patient-label', capstoneAuth?.context?.scenario?.age ? `${demo.patientName} · ${capstoneAuth.context.scenario.age}세` : demo.patientName],
    ['#studio-source-label', selectedStudy.sourceHospitalId || '확인 대기'],
    ['#studio-date-label', selectedStudy.studyDate || '확인 대기'],
  ]) { const node = document.querySelector(selector); if (node) node.textContent = value; }
  const label = document.querySelector("#viewer-study-label");
  if (label) label.textContent = `${selectedStudy.description} (${selectedStudy.modality})`;
  const perm = document.querySelector("#viewer-perm-label");
  if (perm) perm.textContent = latestTokenInfo?.permission || '서버 검증 대기';
}

function resetViewerData() {
  stopCinePlayback();
  clearSliceBlobCache();
  lastSeries = [];
  lastInstances = [];
  selectedSopUid = "";
  currentSliceIndex = 0;
  totalSlices = 1;
  updateSliceControlsUi();
  hideSeriesImage();
  setDownloadState();
  renderTransferSelection();
}

function setDownloadState() {
  if (downloadButton) {
    downloadButton.disabled = true;
    downloadButton.hidden = true;
    downloadButton.title = 'PC 다운로드 차단 · 승인된 B병원 PACS 보관만 제공';
  }
}

function requireToken() {
  if (latestToken) return true;
  showViewerMessage("단기 접근토큰이 필요합니다. 먼저 토큰 발급을 요청하세요.", "fail");
  if (viewerStatus) viewerStatus.textContent = "토큰 필요";
  return false;
}

function showSeriesImage(imageUrl, label) {
  // Only locally created URLs from authorized pixel responses may enter the viewport.
  if (!imageUrl?.startsWith('blob:')) { hideSeriesImage(); return; }
  document.querySelectorAll('[data-viewer-series-uid]').forEach((item) => {
    const preview = item.querySelector('.hp-series-preview');
    if (preview && item.dataset.viewerSeriesUid === selectedSeriesUid) {
      preview.src = imageUrl;
      preview.hidden = false;
    }
  });
  if (viewerImage) {
    viewerImage.src = imageUrl;
    viewerImage.alt = label;
    viewerImage.hidden = false;
  }
  if (viewerPlaceholder) viewerPlaceholder.hidden = true;
}

function hideSeriesImage() {
  document.querySelectorAll('.hp-series-preview').forEach((image) => {
    image.removeAttribute('src'); image.hidden = true;
  });
  if (viewerImage) {
    viewerImage.removeAttribute("src");
    viewerImage.hidden = true;
  }
  if (viewerPlaceholder) viewerPlaceholder.hidden = false;
  if (instanceDetail) {
    instanceDetail.hidden = true;
    instanceDetail.textContent = "";
  }
}

function showViewerMessage(message, tone = "info") {
  if (!viewerAlert) return;
  viewerAlert.textContent = message;
  viewerAlert.title = message;
  viewerAlert.dataset.tone = tone;
}

function setPatientStatus(text) {
  if (patientStatus) patientStatus.textContent = text;
  const dashStatus = document.querySelector("#patient-dashboard-status");
  if (dashStatus) dashStatus.textContent = text;
}

function toggleEasyMode() {
  isEasyMode = !isEasyMode;
  document.querySelector("#patient-portal-app")?.classList.toggle("premium-large-text", isEasyMode);
  const btn1 = document.querySelector("#toggle-easy-mode");
  const btn2 = document.querySelector("#easyModeToggle");
  if (btn1) btn1.textContent = isEasyMode ? "표준 모드 (DICOM 메타)" : "쉬운 모드 (우리말 설명)";
  if (btn2) {
    btn2.setAttribute("aria-pressed", String(isEasyMode));
    btn2.classList.toggle("active", isEasyMode);
  }
  renderStudies(lastStudies);
}

// --------------------------------------------------------------------------
// 5-Step Pipeline Synchronization
// --------------------------------------------------------------------------
function updatePipelineSteps() {
  const stepConsent = document.querySelector("#step-consent");
  const stepPolicy = document.querySelector("#step-policy");
  const stepToken = document.querySelector("#step-token");
  const stepDicom = document.querySelector("#step-dicomweb");
  const stepAudit = document.querySelector("#step-audit");
  const overallStatus = document.querySelector("#pipeline-overall-status");
  const sessionIdEl = document.querySelector("#pipeline-session-id");
  const line1 = document.querySelector("#line-1");
  const line2 = document.querySelector("#line-2");
  const line3 = document.querySelector("#line-3");
  const line4 = document.querySelector("#line-4");

  if (!stepConsent) return;

  if (latestTokenInfo?.auditSessionId && sessionIdEl) {
    sessionIdEl.textContent = latestTokenInfo.auditSessionId.slice(0, 16);
  }

  // Step 1: Consent
  if (patientConsentReady) {
    stepConsent.className = "step-node completed";
    line1?.classList.add("completed");
    stepPolicy.className = "step-node active";
    if (overallStatus) {
      overallStatus.textContent = "동의 확인됨 (ACTIVE)";
      overallStatus.className = "mq-badge mq-badge-good";
    }
  } else {
    stepConsent.className = "step-node active";
    line1?.classList.remove("completed");
    stepPolicy.className = "step-node";
    if (overallStatus) {
      overallStatus.textContent = "동의 대기";
      overallStatus.className = "mq-badge mq-badge-warn";
    }
  }

  // Steps 2 & 3: Policy & Token
  if (latestToken) {
    stepPolicy.className = "step-node completed";
    line2?.classList.add("completed");
    stepToken.className = "step-node completed";
    line3?.classList.add("completed");
    stepDicom.className = "step-node active";
    if (overallStatus) {
      overallStatus.textContent = "단기 토큰 발급됨 (ONLINE)";
      overallStatus.className = "mq-badge mq-badge-good";
    }
  } else {
    stepToken.className = "step-node";
    line2?.classList.remove("completed");
    line3?.classList.remove("completed");
  }

  // Steps 4 & 5: DICOMweb & Audit
  if (lastSeries.length > 0 || viewerImage?.src) {
    stepDicom.className = "step-node completed";
    line4?.classList.add("completed");
    stepAudit.className = "step-node completed";
    if (overallStatus) {
      overallStatus.textContent = "영상 조회 및 감사 기록 완료";
      overallStatus.className = "mq-badge mq-badge-good";
    }
  }
}

// --------------------------------------------------------------------------
// Countdown Timer & Watermark
// --------------------------------------------------------------------------
function startCountdownTimer(expiresAtIso) {
  if (countdownTimerId) clearInterval(countdownTimerId);
  const badge = document.querySelector("#viewer-countdown");
  if (!badge) return;

  function tick() {
    const remainingMs = new Date(expiresAtIso).getTime() - Date.now();
    if (remainingMs <= 0) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      stopCinePlayback();
      clearSliceBlobCache();
      hideSeriesImage();
      badge.textContent = "토큰 만료됨 (재발급 필요)";
      latestToken = null;
      latestTokenInfo = null;
      if (viewerStatus) viewerStatus.textContent = "Token expired";
      setDownloadState();
      showViewerMessage("열람 권한이 만료되었습니다. 상단의 ‘계속 열람’을 눌러 공유 동의를 다시 확인해 주세요.", "warning");
      updatePipelineSteps();
      return;
    }
    const totalSec = Math.floor(remainingMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    badge.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")} 남음`;
  }

  tick();
  countdownTimerId = setInterval(tick, 1000);
}

function clearCountdownTimer() {
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
  stopCinePlayback();
  clearSliceBlobCache();
  const badge = document.querySelector("#viewer-countdown");
  if (badge) badge.textContent = "세션 대기";
}

function updateWatermark(sessionInfo) {
  const wm = document.querySelector("#viewer-watermark");
  if (!wm) return;
  const doc = demo.doctorId;
  const hosp = demo.targetHospitalId;
  const pt = demo.patientId;
  const sess = sessionInfo?.auditSessionId || "SECURE-AUDIT-SESSION";
  const ts = new Date().toLocaleString("ko-KR", { hour12: false });
  wm.textContent = `${hosp} · ${doc} · ${pt} · ${sess.slice(0, 16)} · ${ts}`;
}

// --------------------------------------------------------------------------
// Viewer Dark Tools
// --------------------------------------------------------------------------
function toggleInvert() {
  isInverted = !isInverted;
  const btn = document.querySelector("#tool-invert");
  if (btn) { btn.classList.toggle("active", isInverted); btn.setAttribute('aria-pressed',String(isInverted)); }
  applyViewerFilters();
}

function cycleZoom() {
  zoomScaleIndex = (zoomScaleIndex + 1) % zoomScales.length;
  const scale = zoomScales[zoomScaleIndex];
  const btn = document.querySelector("#tool-zoom");
  if (btn) {
    (btn.querySelector('span') || btn).textContent = zoomScaleIndex === 0 ? "확대" : `${scale}×`;
    btn.classList.toggle("active", zoomScaleIndex > 0);
  }
  applyViewerTransforms();
}

function togglePan() {
  const btn = document.querySelector("#tool-pan");
  const box = document.querySelector("#viewer-viewport-box");
  if (btn) {
    const active = btn.classList.toggle("active");
    btn.setAttribute('aria-pressed',String(active));
    if (box) { box.style.cursor = active ? "grab" : ""; box.style.touchAction = active ? 'none' : ''; }
  }
}

function cycleWwWl() {
  wwWlPresetIndex = (wwWlPresetIndex + 1) % wwWlPresets.length;
  const preset = wwWlPresets[wwWlPresetIndex];
  const btn = document.querySelector("#tool-ww-wl");
  if (btn) {
    (btn.querySelector('span') || btn).textContent = wwWlPresetIndex === 0 ? "화면 대비" : `대비 ${wwWlPresetIndex}`;
    btn.classList.toggle("active", wwWlPresetIndex > 0);
  }
  applyViewerFilters();
}

function toggleSideBySide() {
  isSideBySideActive = !isSideBySideActive;
  const btn = document.querySelector("#tool-side-by-side");
  const box = document.querySelector("#viewer-viewport-box");
  if (btn) btn.classList.toggle("active", isSideBySideActive);
  if (box) box.classList.toggle("side-by-side-layout", isSideBySideActive);
}

function applyViewerFilters() {
  const img = document.querySelector("#viewer-image");
  if (!img) return;
  const preset = wwWlPresets[wwWlPresetIndex];
  const filters = [];
  if (isInverted) filters.push("invert(1)");
  if (preset.contrast !== 1) filters.push(`contrast(${preset.contrast})`);
  if (preset.brightness !== 1) filters.push(`brightness(${preset.brightness})`);
  img.style.filter = filters.join(" ");
  const hud = document.querySelector('#viewer-hud-ww');
  if (hud) hud.textContent = `화면 대비 · ${wwWlPresetIndex ? `프리셋 ${wwWlPresetIndex}` : '기본'}`;
}

function applyViewerTransforms() {
  const img = document.querySelector("#viewer-image");
  if (!img) return;
  const scale = zoomScales[zoomScaleIndex];
  img.style.transform = scale === 1 ? "" : `scale(${scale})`;
}

function resetViewerTools() {
  isInverted = false;
  zoomScaleIndex = 0;
  wwWlPresetIndex = 0;
  isSideBySideActive = false;

  const btnWw = document.querySelector("#tool-ww-wl");
  if (btnWw) { (btnWw.querySelector('span') || btnWw).textContent = "화면 대비"; btnWw.classList.remove("active"); }
  const btnZoom = document.querySelector("#tool-zoom");
  if (btnZoom) { (btnZoom.querySelector('span') || btnZoom).textContent = "확대"; btnZoom.classList.remove("active"); }
  const btnPan = document.querySelector("#tool-pan");
  if (btnPan) { btnPan.classList.remove("active"); btnPan.setAttribute('aria-pressed','false'); }
  const btnInv = document.querySelector("#tool-invert");
  if (btnInv) { btnInv.classList.remove("active"); btnInv.setAttribute('aria-pressed','false'); }
  const btnSide = document.querySelector("#tool-side-by-side");
  if (btnSide) btnSide.classList.remove("active");

  applyViewerFilters();
  applyViewerTransforms();

  const box = document.querySelector("#viewer-viewport-box");
  if (box) {
    box.style.cursor = "";
    box.style.touchAction = "";
    box.classList.remove("side-by-side-layout");
  }
}

// --------------------------------------------------------------------------
// PACS Import (STOW-RS)
// --------------------------------------------------------------------------
function transferItemsForPreflight() {
  if (transferQueue.length) return transferQueue.map(({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }) =>
    ({ studyInstanceUid, seriesInstanceUid, sopInstanceUid }));
  return selectedStudyUid && selectedSeriesUid && selectedSopUid
    ? [{ studyInstanceUid: selectedStudyUid, seriesInstanceUid: selectedSeriesUid, sopInstanceUid: selectedSopUid }] : [];
}

function transferQueueFingerprint(items = transferItemsForPreflight()) {
  const consentId = transferQueue.length ? transferQueueConsentId : getConsentForStudy(items[0]?.studyInstanceUid, lastConsents)?.consentId;
  return JSON.stringify({ consentId: consentId ?? "", items });
}

function renderTransferJobChoices() {
  const select = document.querySelector('#transfer-job-select');
  const resume = document.querySelector('#transfer-job-resume');
  const resumeButton = document.querySelector('#btn-resume-pacs-job');
  if (!select) return;
  activeTransferJobs = activeTransferJobs.filter(job => job && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(job.jobId ?? ''));
  const previous = activeTransferJobId;
  const options = activeTransferJobs.map(job => {
    const option = document.createElement('option');
    option.value = job.jobId;
    option.textContent = `${job.state} · ${job.succeededItems}/${job.totalItems} 완료 · ${job.failedItems}건 실패`;
    return option;
  });
  if (!options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '미완료 작업 없음';
    options.push(option);
  }
  select.replaceChildren(...options);
  activeTransferJobId = activeTransferJobs.find(job => job.jobId === previous)?.jobId ?? activeTransferJobs[0]?.jobId ?? '';
  select.value = activeTransferJobId;
  select.disabled = pacsImportBusy || activeTransferJobs.length === 0;
  if (resume) resume.hidden = activeTransferJobs.length === 0;
  if (resumeButton) resumeButton.disabled = pacsImportBusy || !activeTransferJobId;
}

function renderTransferSelection() {
  const list = document.querySelector('#transfer-selection-list');
  const count = document.querySelector('#transfer-selection-count');
  const addButton = document.querySelector('#btn-add-series-transfer-items');
  const runButton = document.querySelector('#btn-pacs-import-run');
  const confirmation = document.querySelector('#pacs-import-confirm');
  const confirmationLabel = document.querySelector('#pacs-import-confirm-label');
  const items = transferQueue;
  if (count) count.textContent = `작업에 담긴 영상 ${items.length}건`;
  if (confirmationLabel) confirmationLabel.textContent = items.length
    ? `${items.length}건을 환자 동의 범위에 따라 B병원 PACS로 가져옵니다.`
    : selectedSopUid ? '현재 선택한 영상 1건을 환자 동의 범위에 따라 B병원 PACS로 가져옵니다.'
      : '전송할 영상을 추가하거나 Viewer에서 Instance를 선택하세요.';
  if (list) {
    list.replaceChildren(...items.map((item, index) => {
      const row = document.createElement('li');
      const study = lastStudies.find(candidate => candidate.studyInstanceUid === item.studyInstanceUid);
      const label = document.createElement('span');
      label.textContent = `${study?.description || '선택 검사'} · 영상 ${index + 1}`;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.dataset.removeTransferItem = String(index);
      remove.setAttribute('aria-label', `전송 선택 영상 ${index + 1}건에서 제거`);
      remove.textContent = '제거';
      remove.disabled = pacsImportBusy || activeTransferJobs.length > 0;
      row.append(label, remove);
      return row;
    }));
  }
  if (addButton) {
    addButton.disabled = pacsImportBusy || !selectedStudyUid || !selectedSeriesUid || lastInstances.length === 0;
    addButton.textContent = lastInstances.length ? `현재 Series 영상 추가 (${lastInstances.length})` : '현재 Series 영상 추가';
  }
  if (runButton) runButton.disabled = pacsImportBusy || activeTransferJobs.length > 0 || !isPreflightPassed || !confirmation?.checked;
  renderTransferJobChoices();
}

function addCurrentSeriesToTransfer() {
  if (pacsImportBusy || !lastInstances.length || !selectedStudyUid || !selectedSeriesUid) return;
  const consent = getConsentForStudy(selectedStudyUid, lastConsents);
  if (!consent || consent.status !== 'ACTIVE' || consent.permission !== 'DOWNLOAD_ALLOWED'
      || consent.targetHospitalId !== demo.targetHospitalId) {
    showToast('현재 Series에 유효한 다운로드 동의가 없습니다. 환자 동의 범위와 수신 병원을 확인하세요.');
    return;
  }
  if (transferQueue.length && transferQueueConsentId !== consent.consentId) {
    showToast('한 작업에는 하나의 환자 동의만 담을 수 있습니다. 기존 작업을 먼저 실행하세요.');
    return;
  }
  const known = new Set(transferQueue.map(item => `${item.studyInstanceUid}\0${item.seriesInstanceUid}\0${item.sopInstanceUid}`));
  let added = 0;
  for (const instance of lastInstances) {
    const sopInstanceUid = dicomValue(instance, '00080018');
    const item = { studyInstanceUid: selectedStudyUid, seriesInstanceUid: selectedSeriesUid, sopInstanceUid };
    if (!importPreflight(consent, { ...item, hospitalId: demo.targetHospitalId }).ready) continue;
    const key = `${item.studyInstanceUid}\0${item.seriesInstanceUid}\0${item.sopInstanceUid}`;
    if (known.has(key)) continue;
    if (transferQueue.length >= 10000) break;
    transferQueue.push(item); known.add(key); added++;
  }
  if (added) transferQueueConsentId = consent.consentId;
  renderTransferSelection();
  runPreflightCheck();
  if (added) showToast(`환자 동의 범위에 포함된 영상 ${added}건을 전송 작업에 추가했습니다.`);
  else showToast('추가할 수 있는 새 영상이 없습니다. 이미 선택했거나 동의 범위 밖일 수 있습니다.');
}

function runPreflightCheck() {
  if (pacsImportBusy) return;
  isPreflightPassed = false;
  preflightFingerprint = "";
  const pill = document.querySelector("#pacs-import-status-pill");
  const log = document.querySelector("#pacs-import-log");
  const runBtn = document.querySelector("#btn-pacs-import-run");
  const integrityStatus = document.querySelector("#pacs-integrity-status");
  const destStatus = document.querySelector("#pacs-destination-status");
  const items = transferItemsForPreflight();
  const consent = transferQueue.length
    ? lastConsents.find(row => row.consentId === transferQueueConsentId)
    : getConsentForStudy(items[0]?.studyInstanceUid ?? selectedStudyUid, lastConsents);
  const perItem = items.map(item => importPreflight(consent, { ...item, hospitalId: demo.targetHospitalId }));
  const baseChecks = perItem[0]?.checks ?? importPreflight(consent, { hospitalId: demo.targetHospitalId }).checks;
  const checksForItems = baseChecks.map(([name, , reason], index) => {
    const valid = items.length > 0 && perItem.every(result => result.checks[index]?.[1] === true);
    const failed = perItem.find(result => result.checks[index]?.[1] !== true)?.checks[index]?.[2];
    return [name, valid, valid ? `${items.length}개 항목 확인 · 서버 재검증 필요` : failed ?? reason];
  });
  const readiness = { ready: items.length > 0 && perItem.every(result => result.ready), checks: checksForItems };
  const study = lastStudies.find(s => s.studyInstanceUid === items[0]?.studyInstanceUid);
  const context = document.querySelector('#pacs-import-context');
  if (context) context.textContent = `${study?.description || '검사 미선택'} · ${consent?.sourceHospitalId || '출처 미확인'} → ${consent?.targetHospitalId || '수신 병원 미확인'} · ${items.length}건`;
  const folderTitle = document.querySelector('#vault-folder-title'); if(folderTitle) folderTitle.textContent=study?.description || '검사를 선택하세요';
  const folderModality = document.querySelector('#vault-folder-modality'); if(folderModality) folderModality.textContent=study?.modality || '영상';
  const deadline = document.querySelector('#vault-consent-deadline'); if(deadline) deadline.textContent=consent?.validUntil ? formatDate(consent.validUntil) : '공유 종료 시각을 확인하세요';
  const checks = document.querySelector('#pacs-local-checks');
  if (checks) checks.replaceChildren(...readiness.checks.map(([name, ok, reason]) => {
    const row = document.createElement('li');
    const title = document.createElement('strong'); title.textContent = name;
    const status = document.createElement('span'); status.textContent = ok ? '화면 정보 일치 · 서버 재검증 필요' : reason;
    row.dataset.ready = String(ok); row.append(title, status); return row;
  }));
  const confirmation = document.querySelector('#pacs-import-confirm');
  if (confirmation) confirmation.checked = false;
  if (runBtn) runBtn.disabled = true;
  if (integrityStatus) integrityStatus.textContent = '실행 전';
  if (destStatus) destStatus.textContent = '실제 PACS 등록 미검증';
  const transferStatus = document.querySelector('#pacs-transfer-status');
  if (transferStatus) transferStatus.textContent = '요청하지 않음';
  const gotoBtn = document.querySelector('#btn-goto-pacs-archive');
  if (gotoBtn) gotoBtn.style.display = 'none';
  if (!readiness.ready) {
    isPreflightPassed = false;
    if (pill) {
      pill.textContent = "실행 조건 확인 필요";
      pill.className = "mq-badge mq-badge-bad";
    }
    if (log) {
      log.textContent = readiness.checks.find(([, ok]) => !ok)[2];
      log.dataset.tone = "fail";
    }
    if (runBtn) runBtn.disabled = true;
    renderTransferSelection();
    return;
  }

  isPreflightPassed = true;
  preflightFingerprint = transferQueueFingerprint(items);
  if (pill) {
    pill.textContent = "화면 정보 확인 · 서버 권한 검증 대기";
    pill.className = "mq-badge mq-badge-good";
  }
  if (integrityStatus) integrityStatus.textContent = "B PACS 재조회 전";
  if (destStatus) destStatus.textContent = "B PACS 등록 전";
  if (log) {
    log.textContent = `${items.length}개 DICOM 인스턴스를 영속 작업으로 등록합니다. 영상별로 현재 동의를 재검증하고 B PACS 재조회 영수증이 일치해야 완료로 집계합니다.`;
    log.dataset.tone = "success";
  }
  renderTransferSelection();
}

async function runPacsImport() {
  if (pacsImportBusy || !isPreflightPassed || !document.querySelector('#pacs-import-confirm')?.checked) return;
  const items = transferItemsForPreflight();
  if (!preflightFingerprint || preflightFingerprint !== transferQueueFingerprint(items)) {
    const confirmation = document.querySelector('#pacs-import-confirm');
    if (confirmation) confirmation.checked = false;
    runPreflightCheck();
    return;
  }
  const consent = transferQueue.length
    ? lastConsents.find(row => row.consentId === transferQueueConsentId)
    : getConsentForStudy(items[0]?.studyInstanceUid, lastConsents);
  if (!consent || items.some(item => !importPreflight(consent, { ...item, hospitalId: demo.targetHospitalId }).ready)) {
    runPreflightCheck(); return;
  }
  pacsImportBusy = true;
  renderTransferSelection();
  const pill = document.querySelector("#pacs-import-status-pill");
  const log = document.querySelector("#pacs-import-log");
  const integrityStatus = document.querySelector("#pacs-integrity-status");
  const destStatus = document.querySelector("#pacs-destination-status");
  const transferStatus = document.querySelector("#pacs-transfer-status");
  const confirmationLabel = document.querySelector('#pacs-import-confirm-label');
  try {
    if (activeTransferJobId) throw Object.assign(new Error('ACTIVE_TRANSFER_JOB_EXISTS'), { code: 'ACTIVE_TRANSFER_JOB_EXISTS' });
    if (pill) { pill.textContent = '작업 등록 중...'; pill.className = 'mq-badge mq-badge-warn'; }
    if (log) { log.textContent = `동의된 영상 ${items.length}건으로 재시작 가능한 B PACS 전송 작업을 만들고 있습니다.`; log.dataset.tone = 'loading'; }
    const created = await fetchJson('/api/pacs-transfer-jobs', { method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ consentId: consent.consentId, items }) });
    if (created.error || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(created.jobId ?? '')) {
      throw Object.assign(new Error(created.error || 'PACS_TRANSFER_JOB_CREATE_FAILED'), { code: created.error || 'PACS_TRANSFER_JOB_CREATE_FAILED' });
    }
    activeTransferJobId = created.jobId;
    activeTransferJobs.unshift({ jobId: created.jobId, state: 'CREATED', totalItems: items.length,
      succeededItems: 0, failedItems: 0, validUntil: consent.validUntil });
    renderTransferJobChoices();
    if (confirmationLabel) confirmationLabel.textContent = `작업 ${items.length}건을 B병원 PACS로 가져오는 중입니다.`;
    await processPacsTransferJob(activeTransferJobId);
  } catch (error) {
    showTransferFailure(error);
  } finally {
    pacsImportBusy = false;
    isPreflightPassed = false;
    const confirmation = document.querySelector('#pacs-import-confirm'); if (confirmation) confirmation.checked = false;
    await restorePacsTransferJob();
    renderTransferSelection();
  }
}

async function processPacsTransferJob(jobId) {
  const pill = document.querySelector('#pacs-import-status-pill');
  const log = document.querySelector('#pacs-import-log');
  const integrity = document.querySelector('#pacs-integrity-status');
  const destination = document.querySelector('#pacs-destination-status');
  const transferStatus = document.querySelector('#pacs-transfer-status');
  while (true) {
    if (consentMutationPending) throw Object.assign(new Error('CONSENT_CHANGED'), { code: 'VIEW_CONTEXT_CHANGED' });
    const claim = await fetchJson(`/api/pacs-transfer-jobs/${encodeURIComponent(jobId)}/claim`, { method: 'POST' });
    if (claim.error) throw Object.assign(new Error(claim.error), { code: claim.error });
    if (claim.claimed !== true) {
      const job = claim.job ?? await fetchJson(`/api/pacs-transfer-jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      if (job.error) throw Object.assign(new Error(job.error), { code: job.error });
      showPacsTransferJob(job);
      if (log && job.items?.some(item => ['IN_PROGRESS', 'RETRYABLE', 'PENDING'].includes(item.state))) {
        log.textContent = '작업이 저장되었습니다. 이미 실행 중인 항목이 있거나 다음 lease를 기다리는 중입니다. 잠시 뒤 상태를 새로 확인하거나 이어서 처리하세요.';
        log.dataset.tone = 'loading';
      }
      return;
    }
    const { item } = claim;
    if (!item || claim.permission !== 'DOWNLOAD_ALLOWED' || !claim.consentId || !claim.auditSessionId) {
      throw Object.assign(new Error('TRANSFER_CLAIM_INVALID'), { code: 'TRANSFER_CLAIM_INVALID' });
    }
    if (pill) { pill.textContent = '영상 전송 중...'; pill.className = 'mq-badge mq-badge-warn'; }
    if (log) { log.textContent = `영상 ${item.ordinal}을 A Gateway에서 받아 B PACS에 등록하고 재조회하는 중입니다.`; log.dataset.tone = 'loading'; }
    let importStarted = false;
    try {
      const token = await postJson('/api/dicom-access/request', { consentId: claim.consentId,
        doctorId: demo.doctorId, requestingHospitalId: claim.targetHospitalId,
        studyInstanceUid: item.studyInstanceUid, seriesInstanceUid: item.seriesInstanceUid,
        purpose: claim.purpose, requestedAction: 'DOWNLOAD' });
      const expiresAt = Date.parse(token.expiresAt);
      if (token.error || token.decision !== 'ALLOWED' || token.tokenType !== 'DPoP' || !token.accessToken
          || token.permission !== 'DOWNLOAD_ALLOWED' || token.allowedStudyUid !== item.studyInstanceUid
          || (token.allowedSeriesUids?.length && !token.allowedSeriesUids.includes(item.seriesInstanceUid))
          || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw Object.assign(new Error(token.reasonCode || token.error || 'DOWNLOAD_TOKEN_DENIED'),
          { code: token.reasonCode || token.error || 'DOWNLOAD_TOKEN_DENIED' });
      }
      if (consentMutationPending) throw Object.assign(new Error('CONSENT_CHANGED'), { code: 'VIEW_CONTEXT_CHANGED' });
      importStarted = true;
      const receipt = await fetchJson(`/dicomweb/studies/${item.studyInstanceUid}/series/${item.seriesInstanceUid}/instances/${item.sopInstanceUid}/import`, {
        method: 'POST', headers: { authorization: `Bearer ${token.accessToken}`,
          'x-hipass-transfer-job-id': claim.jobId, 'x-hipass-transfer-item-id': item.itemId,
          'x-hipass-transfer-lease-id': claim.leaseId },
      });
      if (receipt.error || receipt.status !== 'PACS_INSTANCE_VERIFIED' || receipt.simulation !== false
          || receipt.destinationVerification !== true || receipt.studyInstanceUid !== item.studyInstanceUid
          || receipt.seriesInstanceUid !== item.seriesInstanceUid || receipt.sopInstanceUid !== item.sopInstanceUid
          || !/^[a-f0-9]{64}$/u.test(receipt.sha256 ?? '') || !Number.isSafeInteger(receipt.bytes) || receipt.bytes < 132) {
        throw Object.assign(new Error(receipt.error || 'PACS_RECEIPT_INVALID'), { code: receipt.error || 'PACS_RECEIPT_INVALID', importStarted });
      }
      if (integrity) integrity.textContent = `B PACS 재조회 · SHA-256 일치 · ${item.ordinal}번`;
      if (destination) destination.textContent = 'B병원 PACS UID·원본 해시 재검증';
      renderOutput({ status: receipt.status, studyInstanceUid: receipt.studyInstanceUid,
        seriesInstanceUid: receipt.seriesInstanceUid, sopInstanceUid: receipt.sopInstanceUid,
        sha256: receipt.sha256, bytes: receipt.bytes, alreadyStored: receipt.alreadyStored === true });
      const job = await fetchJson(`/api/pacs-transfer-jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      if (job.error) throw Object.assign(new Error(job.error), { code: job.error, importStarted: true });
      showPacsTransferJob(job);
      if (transferStatus) transferStatus.textContent = `${job.succeededItems}/${job.totalItems} 완료`;
    } catch (error) {
      if (error && typeof error === 'object' && error.importStarted === undefined) error.importStarted = importStarted;
      throw error;
    }
  }
}

function showPacsTransferJob(job) {
  const total = Number(job.totalItems ?? job.items?.length ?? 0);
  const succeeded = Number(job.succeededItems ?? job.items?.filter(item => item.state === 'SUCCEEDED').length ?? 0);
  const failed = Number(job.failedItems ?? job.items?.filter(item => ['FAILED', 'EXPIRED', 'REVOKED'].includes(item.state)).length ?? 0);
  const remaining = job.items?.some(item => ['PENDING', 'IN_PROGRESS', 'RETRYABLE'].includes(item.state)) ?? false;
  const pill = document.querySelector('#pacs-import-status-pill');
  const log = document.querySelector('#pacs-import-log');
  const transferStatus = document.querySelector('#pacs-transfer-status');
  if (pill) { pill.textContent = remaining ? '작업 저장 · 이어서 가능' : failed ? '일부 영상 확인 필요' : 'B PACS 등록 확인';
    pill.className = remaining ? 'mq-badge mq-badge-warn' : failed ? 'mq-badge mq-badge-bad' : 'mq-badge mq-badge-good'; }
  if (transferStatus) transferStatus.textContent = `${succeeded}/${total} 완료 · ${failed}건 실패`;
  if (log && !remaining) { log.textContent = failed
      ? `작업 ${total}건 중 ${succeeded}건이 수신 검증됐고 ${failed}건은 실패 상태입니다. 실패 항목을 성공으로 간주하지 않았습니다.`
      : `작업 ${total}건 모두 B PACS 저장 후 UID·원본 SHA-256 재조회가 확인됐습니다.`;
    log.dataset.tone = failed ? 'fail' : 'success'; }
  const resumeStatus = document.querySelector('#transfer-job-resume-status');
  if (resumeStatus) resumeStatus.textContent = `작업 상태 ${job.state} · ${succeeded}/${total} 완료 · ${failed}건 실패${remaining ? ' · 미완료 항목 있음' : ''}`;
  if (remaining) {
    const summary = { jobId: job.jobId, state: job.state, totalItems: total, succeededItems: succeeded,
      failedItems: failed, validUntil: job.validUntil };
    const index = activeTransferJobs.findIndex(candidate => candidate.jobId === job.jobId);
    if (index < 0) activeTransferJobs.unshift(summary);
    else activeTransferJobs[index] = summary;
  } else activeTransferJobs = activeTransferJobs.filter(candidate => candidate.jobId !== job.jobId);
  if (!remaining && activeTransferJobId === job.jobId) {
    activeTransferJobId = '';
    transferQueue = []; transferQueueConsentId = '';
  }
  renderTransferJobChoices();
  renderTransferSelection();
}

function showTransferFailure(error) {
  const raw = error?.code ?? error?.message ?? 'PACS_TRANSFER_FAILED';
  const reason = /^[A-Z][A-Z0-9_]{0,63}$/u.test(raw) ? raw : 'PACS_TRANSFER_FAILED';
  const importStarted = error?.importStarted === true;
  const pill = document.querySelector('#pacs-import-status-pill');
  const log = document.querySelector('#pacs-import-log');
  const transferStatus = document.querySelector('#pacs-transfer-status');
  const destination = document.querySelector('#pacs-destination-status');
  if (pill) { pill.textContent = importStarted ? '수신 결과 확인 필요' : '작업이 중단됨'; pill.className = 'mq-badge mq-badge-bad'; }
  if (log) { log.textContent = importStarted
      ? `전송 응답을 확인하지 못했습니다 (${toFriendlyError(reason)}). 확인 코드: ${reason}. 자동 재전송하지 않았습니다. 저장된 작업과 lease 상태를 확인한 뒤 재개하세요.`
      : `전송 작업을 계속하지 못했습니다: ${toFriendlyError(reason)}. 확인 코드: ${reason}. 동의와 접근 정책을 다시 확인하세요.`;
    log.dataset.tone = 'fail'; }
  if (transferStatus) transferStatus.textContent = importStarted ? '수신 결과 미확인' : '작업 중단';
  if (destination) destination.textContent = importStarted ? 'B PACS 결과 재확인 필요' : 'B PACS 등록 미확인';
  if (activeTransferJobId) {
    const panel = document.querySelector('#transfer-job-resume');
    const status = document.querySelector('#transfer-job-resume-status');
    if (panel) panel.hidden = false;
    if (status) status.textContent = '작업이 저장되어 있습니다. 현재 동의를 다시 확인한 뒤 미완료 항목을 재개할 수 있습니다.';
  }
  renderTransferSelection();
}

async function restorePacsTransferJob() {
  if (currentPersona !== 'DOCTOR') return;
  const panel = document.querySelector('#transfer-job-resume');
  const status = document.querySelector('#transfer-job-resume-status');
  if (status) status.textContent = '서버에 저장된 미완료 전송 작업을 확인하고 있습니다.';
  try {
    const result = await fetchJson('/api/pacs-transfer-jobs/active', { cache: 'no-store' });
    if (result.error || !Array.isArray(result.jobs)) throw new Error(result.error || 'PACS_TRANSFER_JOB_LIST_INVALID');
    const previousJobId = activeTransferJobId;
    activeTransferJobs = result.jobs;
    activeTransferJobId = activeTransferJobs.some(job => job.jobId === previousJobId) ? previousJobId : '';
    renderTransferJobChoices();
    if (status) status.textContent = activeTransferJobs.length
      ? `${activeTransferJobs.length}개의 미완료 작업이 서버에 저장되어 있습니다. 선택한 작업을 재개하면 동의와 접근 권한을 다시 확인합니다.`
      : '미완료 전송 작업이 없습니다.';
  } catch {
    activeTransferJobs = [];
    activeTransferJobId = '';
    if (panel) panel.hidden = true;
    renderTransferJobChoices();
  }
  renderTransferSelection();
}

// --------------------------------------------------------------------------
// Hospital B PACS Archive Workstation Module
// --------------------------------------------------------------------------
let lastHospitalBArchives = [];
let archiveRequestVersion = 0;
function updateTransferTracking(state, archives = []) {
  renderHospitalVault(document.querySelector('#hospital-vault-list'),{archives,studies:lastStudies,state});
  renderTransferTracking(document.querySelector('#transfer-tracking'), {
    consent: getConsentForStudy(selectedStudyUid, lastConsents),
    study: lastStudies.find(s => s.studyInstanceUid === selectedStudyUid),
    archives, state,
  });
}

async function loadHospitalBPacsArchive() {
  if(location.hostname==='highpass-demo.japaneast.cloudapp.azure.com'){
    const legacy=document.querySelector('#hospital-vault-list');if(legacy)legacy.hidden=true;
    updateTransferTracking('unavailable');
    return;
  }
  const version = ++archiveRequestVersion;
  updateTransferTracking('loading');
  const tableBody = document.querySelector("#hospital-b-pacs-table-body");
  const kpiStudies = document.querySelector("#kpi-archive-studies");
  const kpiInstances = document.querySelector("#kpi-archive-instances");
  const kpiBytes = document.querySelector("#kpi-archive-bytes");
  const kpiIntegrity = document.querySelector("#kpi-archive-integrity");
  [kpiStudies, kpiInstances, kpiBytes, kpiIntegrity].forEach(el => { if (el) el.textContent = '—'; });
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="8">로컬 보관 목록을 확인하고 있어요.</td></tr>';

  try {
    const res = await fetchJson("/api/hospitals/HOSP-B/pacs-archive", { signal: AbortSignal.timeout(10000) });
    if (version !== archiveRequestVersion) return;
    if (!Array.isArray(res) && !Array.isArray(res?.studies)) throw new Error('보관 목록 응답 형식 오류');
    const archives = Array.isArray(res) ? res : (Array.isArray(res?.studies) ? res.studies : []);
    lastHospitalBArchives = archives;

    const totalStudies = archives.length;
    const totalInstances = archives.reduce((sum, s) => sum + (s.instancesCount || s.instances?.length || 0), 0);
    const totalBytes = archives.reduce((sum, s) => sum + (s.totalBytes || 0), 0);

    if (kpiStudies) kpiStudies.textContent = String(totalStudies);
    if (kpiInstances) kpiInstances.textContent = String(totalInstances);
    if (kpiBytes) kpiBytes.textContent = `${(totalBytes / 1024 / 1024).toFixed(1)} MB`;
    if (kpiIntegrity) {
      if (totalStudies > 0) {
        kpiIntegrity.textContent = "현재 무결성 미검증";
        kpiIntegrity.style.color = "var(--green)";
      } else {
        kpiIntegrity.textContent = "대기 중";
        kpiIntegrity.style.color = "var(--mq-muted)";
      }
    }

    renderHospitalBPacsArchive(archives);
    updateTransferTracking('ready', archives);
  } catch (err) {
    if (version !== archiveRequestVersion) return;
    lastHospitalBArchives = [];
    [kpiStudies, kpiInstances, kpiBytes, kpiIntegrity].forEach(el => { if (el) el.textContent = '—'; });
    updateTransferTracking('error');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;">목록을 확인하지 못했습니다. 상태 다시 확인을 눌러 재조회하세요.</td></tr>';
    }
  }
}

function renderHospitalBPacsArchive(archives) {
  const tableBody = document.querySelector("#hospital-b-pacs-table-body");
  if (!tableBody) return;

  if (!archives || archives.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:36px;color:#94a3b8;">
          <div style="font-size:28px;margin-bottom:8px;">📭</div>
          <strong style="color:#64748b;font-size:14px;display:block;">로컬 보관 기록이 없습니다.</strong>
          <div style="font-size:12px;margin-top:4px;">영상 열람 이력과 보관 목록은 별개입니다. 실제 PACS 등록 상태는 이 목록에서 확인할 수 없습니다.</div>
        </td>
      </tr>
    `;
    tableBody.querySelectorAll("[data-view-jump]").forEach((btn) => {
      btn.addEventListener("click", () => navigateHospitalScreen(btn.dataset.viewJump));
    });
    return;
  }

  tableBody.innerHTML = archives.map((item) => {
    const studyUid = item.studyInstanceUid || "-";
    const patientId = item.patientId || "미확인";
    const sourceHospital = item.sourceHospitalId || "미확인";
    const importedAt = formatDate(item.importedAt);
    const instancesCount = item.instancesCount ?? item.instances?.length ?? '미확인';
    const bytesFormatted = item.totalBytes ? `${(item.totalBytes / 1024 / 1024).toFixed(1)} MB` : "0 MB";
    const sha256 = item.sha256 || "";
    const shortSha = sha256.length > 16 ? `${sha256.slice(0, 8)}...${sha256.slice(-8)}` : (sha256 || "해시 없음");

    const matchedStudy = lastStudies.find((s) => s.studyInstanceUid === studyUid);
    const studyDesc = matchedStudy?.description || "DICOM 검사";
    const modality = matchedStudy?.modality || "DICOM";
    const retentionLabel = ({STORED:'암호화 보관 중',DELETE_PENDING:'접근 차단 · 삭제 처리 중',DELETE_FAILED:'접근 차단 · 삭제 재시도 필요',DELETED:'삭제 완료'})[item.retention?.state] || '보관정책 미지정 · 접근 차단';
    const archiveReadable = item.access?.allowed === true;

    return `
      <tr>
        <td><strong>${escapeHtml(patientId)}</strong></td>
        <td>
          <strong>${escapeHtml(studyDesc)}</strong>
          <span class="mq-badge" style="margin-left:4px;font-size:10px;">${escapeHtml(modality)}</span>
          <div class="pacs-path-tag">${escapeHtml(studyUid.slice(0, 28))}...</div>
        </td>
        <td>${escapeHtml(sourceHospital)}</td>
        <td style="font-size:12px;color:#64748b;">${escapeHtml(importedAt)}</td>
        <td>
          <strong>${escapeHtml(String(instancesCount))}건</strong>
          <small style="color:#64748b;display:block;">(${bytesFormatted})</small>
        </td>
        <td>
          <span class="pacs-hash-badge" title="전체 SHA-256 해시: ${escapeHtml(sha256)} (클릭하여 복사)" data-copy-hash="${escapeHtml(sha256)}">
            🔒 ${escapeHtml(shortSha)}
          </span>
        </td>
        <td>
          <span class="mq-badge" title="서버가 보고한 로컬 보관 메타데이터 · 실제 PACS 등록 증거 아님">
            ${escapeHtml(retentionLabel)}
          </span>
          <small style="display:block;">${item.retention?.validUntil ? '보관 종료: ' + escapeHtml(formatDate(item.retention.validUntil)) : '기한 확인 필요'}</small>
          <small style="display:block;">${archiveReadable ? '보관기간 내 · 열람 권한 별도 검증' : '저장본 접근 차단'}</small>
        </td>
        <td style="white-space:nowrap;">
          <button class="mq-btn small" type="button" data-archive-manifest="${escapeHtml(studyUid)}" title="manifest.json 및 개별 인스턴스 검증 내역 확인">
            Manifest 확인
          </button>
          <button class="mq-btn small mq-btn-primary" type="button" data-archive-view="${escapeHtml(studyUid)}" style="margin-left:4px;" ${archiveReadable ? '' : 'disabled'} title="기존 원본 경로 · B 저장본 열람 연결은 미구현">
            원본 Viewer 이동
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Bind copy hash
  tableBody.querySelectorAll("[data-copy-hash]").forEach((badge) => {
    badge.addEventListener("click", () => {
      const hash = badge.dataset.copyHash;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(hash).then(() => {
          showToast("SHA-256 해시가 클립보드에 복사되었습니다.");
        }).catch(() => {});
      } else {
        showToast(`해시: ${hash}`);
      }
    });
  });

  // Bind Manifest button
  tableBody.querySelectorAll("[data-archive-manifest]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sUid = btn.dataset.archiveManifest;
      const targetArchive = archives.find((a) => a.studyInstanceUid === sUid);
      if (targetArchive) showArchiveManifestModal(targetArchive);
    });
  });

  // Bind Viewer button
  tableBody.querySelectorAll("[data-archive-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sUid = btn.dataset.archiveView;
      selectedStudyUid = sUid;
      navigateHospitalScreen("viewer");
      showToast(`Study ${sUid.slice(0, 16)}... 를 선택하여 뷰어로 전환했습니다.`);
    });
  });
}

function showArchiveManifestModal(archive) {
  const matched = lastStudies.find((s) => s.studyInstanceUid === archive.studyInstanceUid);
  const desc = matched?.description || "DICOM 검사";
  const mod = matched?.modality || "DICOM";
  const instances = Array.isArray(archive.instances) ? archive.instances : [];

  const bodyHtml = `
    <div style="font-size:13px;line-height:1.6;">
      <div class="mq-callout" style="margin-bottom:14px;border-left-color:var(--green);background:rgba(21,128,61,0.08);">
        <p><strong>로컬 보관 메타데이터:</strong> 서버가 반환한 manifest입니다. 현재 파일 해시 재검증, 실제 병원 간 전송 및 PACS 등록 완료를 의미하지 않습니다.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;margin-bottom:14px;">
        <div class="mq-state-card">
          <small style="color:#64748b;">환자 / 검사명</small>
          <strong>${escapeHtml(archive.patientId || '미확인')} · ${escapeHtml(desc)} (${escapeHtml(mod)})</strong>
        </div>
        <div class="mq-state-card">
          <small style="color:#64748b;">원내 보관 상태</small>
          <strong>로컬 보관 기록 · PACS 등록 미검증</strong>
        </div>
        <div class="mq-state-card">
          <small style="color:#64748b;">총 파일 수 및 용량</small>
          <strong>${archive.instancesCount}개 인스턴스 · ${(archive.totalBytes / 1024 / 1024).toFixed(2)} MB (${(archive.totalBytes || 0).toLocaleString()} bytes)</strong>
        </div>
        <div class="mq-state-card">
          <small style="color:#64748b;">임포트 일시 / 방법</small>
          <strong>${formatDate(archive.importedAt)} · ${escapeHtml(archive.transferMethod || "NOT VERIFIED")}</strong>
        </div>
      </div>

      <div class="mq-state-card" style="margin-bottom:14px;">
        <small style="color:#64748b;">저장구간 암호화 스펙 (At-Rest Encryption)</small>
        <strong>${archive.encryptedAtRest ? "AES-256-GCM Envelope Encryption (A256GCM)" : "Plaintext"}</strong>
        <div style="margin-top:6px;font-size:11px;color:#64748b;">
          알고리즘: <code>${escapeHtml(archive.cipherSuite || "미확인")}</code>
        </div>
        <small style="color:#64748b;display:block;margin-top:8px;">StudyInstanceUID</small>
        <code style="font-size:11px;word-break:break-all;display:block;margin-top:2px;">${escapeHtml(archive.studyInstanceUid)}</code>
        <small style="color:#64748b;display:block;margin-top:8px;">Study 전체 집합 SHA-256 무결성 해시</small>
        <code style="font-size:11px;word-break:break-all;color:#15803d;display:block;margin-top:2px;font-weight:700;">${escapeHtml(archive.sha256)}</code>
      </div>

      <h4 style="margin:14px 0 6px;font-size:13px;">개별 DICOM 인스턴스 파일 목록 (${instances.length}건)</h4>
      <div style="max-height:220px;overflow-y:auto;border:1px solid var(--mq-border);border-radius:6px;">
        <table class="manifest-instance-table">
          <thead>
            <tr>
              <th>#</th>
              <th>SOPInstanceUID</th>
              <th>크기 (Cipher / Plain)</th>
              <th>인스턴스 SHA-256</th>
              <th>물리 저장 파일 (.enc)</th>
            </tr>
          </thead>
          <tbody>
            ${instances.map((inst, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml((inst.sopInstanceUid || "").slice(0, 24))}...</td>
                <td>${((inst.cipherBytes || inst.fileSize || 0)).toLocaleString()} B / ${((inst.plainBytes || inst.fileSize || 0)).toLocaleString()} B</td>
                <td title="${escapeHtml(inst.plainSha256 || inst.sha256)}">${escapeHtml((inst.plainSha256 || inst.sha256 || "").slice(0, 12))}...</td>
                <td><code style="font-size:10px;color:#0284c7;">${escapeHtml(inst.storedPath || "-")}</code></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  showModal({
    eyebrow: "Hospital B Local PACS Archive",
    title: "아카이브 Manifest 및 DICOM 바이너리 검증",
    bodyHtml,
    actionsHtml: '<button class="btn primary small" data-close type="button">확인 닫기</button>',
  });
}

/// --------------------------------------------------------------------------
// QR Medical Image Handoff Scanner & Camera Scanner
// --------------------------------------------------------------------------
let cameraStream = null;
let cameraScanningActive = false;
let cameraRequestId = 0;

async function toggleCameraQrScan() {
  const video = document.querySelector("#qr-camera-stream");
  const laserBox = document.querySelector("#qr-laser-box");
  const toggleBtn = document.querySelector("#btn-toggle-camera-scan");
  const message = document.querySelector("#qr-handoff-message");

  if (cameraScanningActive) {
    stopCameraQrScan();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("이 브라우저 환경에서는 카메라 기능을 실행할 수 없습니다.");
    return;
  }

  try {
    const requestId = ++cameraRequestId;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    if (requestId !== cameraRequestId || !video) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    cameraStream = stream;
    video.srcObject = cameraStream;
    video.style.display = "block";
    video.play();
    cameraScanningActive = true;
    if (toggleBtn) toggleBtn.textContent = "🛑 카메라 스캐너 끄기";
    if (laserBox) laserBox.style.display = "flex";
    if (message) message.textContent = "환자 모바일 화면의 QR 코드를 카메라 프레임 중앙에 비춰주세요.";

    requestAnimationFrame(scanCameraFrame);
  } catch (err) {
    showToast("카메라 접근이 거부되었거나 사용 가능한 카메라가 없습니다.");
    stopCameraQrScan();
  }
}

function stopCameraQrScan() {
  cameraRequestId++;
  cameraScanningActive = false;
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  const video = document.querySelector("#qr-camera-stream");
  const toggleBtn = document.querySelector("#btn-toggle-camera-scan");
  if (video) video.style.display = "none";
  if (toggleBtn) toggleBtn.textContent = "📷 카메라 스캐너 켜기";
}

function scanCameraFrame() {
  if (!cameraScanningActive) return;
  const video = document.querySelector("#qr-camera-stream");
  const canvas = document.querySelector("#qr-canvas-preview");
  if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(scanCameraFrame);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (typeof jsQR === "function") {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code && code.data) {
      const match = code.data.match(/\/t\/([A-Za-z0-9_-]{22,128})$/);
      if (match) {
        stopCameraQrScan();
        showToast("QR 코드를 성공적으로 인식했습니다!");
        redeemScannedNonce(match[1]);
        return;
      }
    }
  }

  requestAnimationFrame(scanCameraFrame);
}

let qrReceptionBusy = false;
async function redeemScannedNonce(nonce, inputMethod='CAMERA') {
  if (qrReceptionBusy) return;
  qrReceptionBusy = true;
  stopCameraQrScan();
  const controls = ['qr-manual-submit', 'qr-image-input', 'qr-manual-input', 'btn-toggle-camera-scan', 'btn-reset-qr-scan', 'btn-simulate-qr-scan'];
  controls.forEach(id => { const element = document.getElementById(id); if (element) element.disabled = true; });
  resetQrScan();
  try {
  const statusPill = document.querySelector("#qr-handoff-status");
  const scannedRef = document.querySelector("#qr-scanned-ref");
  const scannedPatient = document.querySelector("#qr-scanned-patient");
  const scannedConsent = document.querySelector("#qr-scanned-consent");
  const scannedToken = document.querySelector("#qr-scanned-token");
  const message = document.querySelector("#qr-handoff-message");

  if (statusPill) {
    statusPill.textContent = "QR 인식 및 검증 중...";
    statusPill.className = "mq-badge mq-badge-warn";
  }

  const redemptionPath = (typeof location !== 'undefined' && location.hostname === 'highpass-demo.japaneast.cloudapp.azure.com') ? '/api/demo/qr/redeem' : '/api/transfers/tickets/redeem-viewer';
  const result = await postJson(redemptionPath, { nonce, inputMethod });
  if (result?.decision === "ALLOWED" && result.accessToken) {
    latestToken = result.accessToken;
    latestTokenInfo = result;
    latestTicketNonce = null;
    selectedStudyUid = result.viewerContext?.studyInstanceUid || selectedStudyUid;
    selectedStudy = lastStudies.find((s) => s.studyInstanceUid === selectedStudyUid) || selectedStudy;
    syncSelectedStudyUi();
    if (viewerStatus) viewerStatus.textContent = "Token issued (QR)";
    setDownloadState();

    if (statusPill) {
      statusPill.textContent = "공유 접수 완료 · 서버 검증 통과";
      statusPill.className = "mq-badge mq-badge-good";
    }
    if (scannedRef) scannedRef.textContent = `${result.ticketId || "TICKET-VERIFIED"} (소진됨)`;
    if (scannedPatient) scannedPatient.textContent = result.patientId || result.viewerContext?.patientId || '접수 확인 · 환자 정보는 진료 준비에서 확인';
    if (scannedConsent) scannedConsent.textContent = `ACTIVE (${result.viewerContext?.permission || "VIEW_ONLY"})`;
    if (scannedToken) scannedToken.textContent = "발급 완료 · 단기 접근 권한";
    if (message) {
      message.textContent = "일회용 QR 접수가 완료되었습니다. 영상 열람은 별도의 영상 경로·권한 확인 후 진행됩니다.";
      message.dataset.tone = "success";
    }

    startCountdownTimer(result.expiresAt);
    updateWatermark(result);
    updatePipelineSteps();
    broadcastSync("QR_SCANNED");
    renderOutput({
      qrEvent: "CLAIM_VERIFIED",
      ticketId: result.ticketId,
      patientId: demo.patientId,
      grantScope: result.viewerContext?.permission || "VIEW_ONLY",
      decision: result.decision,
      auditSessionId: result.auditSessionId,
    });

    // Reception succeeded even if a separate dashboard refresh is unavailable.
    await loadDashboard().catch(()=>{});
    const receptions = typeof fetchJson === 'function' ? await fetchJson('/api/clinician/receptions',{cache:'no-store'}).catch(()=>({})) : {};
    const receipt = receptions?.receptions?.find(row=>row.ticketId===result.ticketId);
    if(receipt){
      if(receipt.studies?.[0])await selectReceptionContext(receipt,receipt.studies[0]);
      else clinicianHealth?.selectReception(receipt.consentId);
      receptionHome?.update(receipt,demo.patientName||receipt.patientId);
    }
    navigateHospitalScreen('dashboard');
    showToast('QR 확인 완료 · 접수 내용 보기에서 이어서 진행하세요.');
  } else {
    if (statusPill) {
      statusPill.textContent = "QR 검증 거부";
      statusPill.className = "mq-badge mq-badge-bad";
    }
    if (message) {
      message.textContent = `검증 거부: ${toFriendlyError(result?.reasonCode || result?.error || "HANDOFF_FAILED")}`;
      message.dataset.tone = "fail";
    }
    renderOutput(result);
  }
  } catch {
    const status = document.querySelector('#qr-handoff-status');
    if (status) status.textContent = '연결 상태 확인 필요';
    const notice = document.querySelector('#qr-handoff-message');
    if (notice) {
      notice.textContent = '서버 응답을 확인하지 못했습니다. 이미 접수되었을 수 있으므로 공유 상태를 확인한 뒤 다시 시도하세요.';
      notice.dataset.tone = 'fail';
    }
  } finally {
    qrReceptionBusy = false;
    controls.forEach(id => { const element = document.getElementById(id); if (element) element.disabled = false; });
  }
}

async function simulateQrScan() {
  // Only substitute camera input. Never issue a patient ticket as a doctor.
  navigateHospitalScreen('dashboard');
  document.querySelector('#reception-import').open=true;
  const input=document.querySelector('#qr-manual-input');
  if(input){input.value='';input.dataset.demoImport='1';input.focus();}
  const hint=document.querySelector('#qr-handoff-message');
  if(hint)hint.textContent='시연 입력 · 환자 화면의 연결 코드를 붙여넣고 접수하세요. 동의·병원·기간·접근 증명은 서버에서 검증합니다.';
}

function resetQrScan() {
  stopCameraQrScan();
  const input = document.querySelector('#qr-manual-input');
  if (input) input.value = '';
  const patient = document.querySelector('#qr-scanned-patient');
  const consent = document.querySelector('#qr-scanned-consent');
  if (patient) patient.textContent = '서버 확인 후 표시';
  if (consent) consent.textContent = '확인 전';
  const statusPill = document.querySelector("#qr-handoff-status");
  const scannedRef = document.querySelector("#qr-scanned-ref");
  const scannedToken = document.querySelector("#qr-scanned-token");
  const message = document.querySelector("#qr-handoff-message");

  if (statusPill) {
    statusPill.textContent = "접수 대기";
    statusPill.className = "mq-badge mq-badge-warn";
  }
  if (scannedRef) scannedRef.textContent = "대기 중";
  if (scannedToken) scannedToken.textContent = "미발급";
  if (message) {
    message.textContent = "환자의 모바일 화면 또는 종이 안내장의 일회용 QR을 스캔하세요.";
    message.dataset.tone = "";
  }
}

function updateVisitModePacket(handoff) {
  if (!handoff) { patientQrController.clear(); return; }
  patientQrController.set(handoff, latestConsentId);
}

// --------------------------------------------------------------------------
// Patient Access Receipts (SPEC-02)
// --------------------------------------------------------------------------
function renderPatientReceipts(consents, logs) {
  // Never expose administrator audit logs as patient receipts.
  patientHistory?.update(lastStudies, consents, consentMutationPending);
}

// --------------------------------------------------------------------------
// Audit Log Table & Metrics
// --------------------------------------------------------------------------
async function loadAuditTimeline() {
  const version=++auditTimelineVersion;
  const root=document.querySelector('#security-timeline');
  renderSecurityTimeline(root,null,'loading');
  renderSecurityObservatory(null,'loading');
  if(currentPersona==='PATIENT') {renderSecurityTimeline(root,null,'error');return;}
  const persona=currentPersona;
  const securityAccess = capstoneAuth?.roles?.some(role => ['SECURITY_ADMIN', 'PLATFORM_ADMIN'].includes(role));
  const observatory = document.querySelector('.security-observatory');
  if (observatory) observatory.hidden = !securityAccess;
  const params=new URLSearchParams({limit:'64'});
  if(auditResultFilter?.value)params.set('result',auditResultFilter.value);
  if(auditActionFilter?.value)params.set('action',auditActionFilter.value);
  try {
    const overview=securityAccess ? await fetchJson(`/api/security/overview?${params}`,{signal:AbortSignal.timeout(15000),cache:'no-store'}) : null;
    const logs=overview?.applicationAudit?.events ?? await fetchJson(`/api/audit-logs?${params}`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(version!==auditTimelineVersion)return;
    if(persona!==currentPersona||!Array.isArray(logs))throw new Error('AUDIT_UNAVAILABLE');
    renderSecurityTimeline(root,logs);
    if(overview)renderSecurityObservatory(overview);
  }catch {if(version===auditTimelineVersion){renderSecurityTimeline(root,null,'error');renderSecurityObservatory(null,'error');}}
}

function renderSecurityObservatory(overview,state='ready') {
  const observatory=document.querySelector('.security-observatory');
  if(!observatory)return;
  if (capstoneAuth?.roles?.some(role => ['SECURITY_ADMIN','PLATFORM_ADMIN'].includes(role))) {
    renderSecurityConsole(observatory, { overview, state, fetchJson, postJson, refresh: loadAuditTimeline });
    return;
  }
  const setSource=(name,label,count,stateName)=>{
    const card=observatory.querySelector(`[data-source-card="${name}"]`);
    if(!card)return;
    const status=card.querySelector('[data-source-status]'),countNode=card.querySelector('[data-source-count]');
    status.textContent=label;status.dataset.state=stateName;
    countNode.textContent=count;
  };
  if(state!=='ready'||!overview) {
    observatory.querySelector('[data-security-observed-at]').textContent=state==='loading'?'출처 확인 중…':'조회 실패 · 인증 또는 권한 확인 필요';
    setSource('app',state==='loading'?'조회 중':'조회 실패',state==='loading'?'기록을 불러오는 중':'결과 없음 · 0건으로 간주하지 않음',state==='loading'?'loading':'failed');
    setSource('azure',state==='loading'?'조회 중':'출처 상태 미확인','API 조회 실패 · 로그가 없다는 뜻이 아님',state==='loading'?'loading':'failed');
    setSource('integrity',state==='loading'?'검증 중':'미확인','검증 근거를 받지 못함',state==='loading'?'loading':'failed');
    drawSecurityFeed(observatory.querySelector('[data-security-app-alerts]'),[],new Map(),'APP','조회할 수 없습니다. 권한과 연결 상태를 확인해 주세요.');
    drawSecurityFeed(observatory.querySelector('[data-security-vault-events]'),[],new Map(),'AZURE_KEYVAULT','조회할 수 없습니다. 로그 미수집과 API 실패를 구분하세요.');
    observatory.querySelector('[data-security-app-count]').textContent='—';
    observatory.querySelector('[data-security-vault-count]').textContent='—';
    return;
  }
  const app=overview.applicationAudit,azure=overview.azureKeyVaultAudit||{},reviews=new Map();
  for(const review of overview.reviews||[]) {
    const key=`${review.source}|${review.eventRef}`;
    if(!reviews.has(key))reviews.set(key,review);
  }
  const observed=Date.parse(overview.observedAt);
  observatory.querySelector('[data-security-observed-at]').textContent=`마지막 조회 ${Number.isFinite(observed)?new Date(observed).toLocaleString('ko-KR'):'시각 미확인'} · 최신 응답 기준`;
  const applicationEvents=Array.isArray(app.events)?app.events:[],appAlerts=Array.isArray(app.alerts)?app.alerts:[];
  setSource('app','연결됨',`표시 ${applicationEvents.length}건 · 경보 ${appAlerts.length}건`,app.status==='available'?'available':'unavailable');
  const azureLabels={available:'연결됨',not_configured:'미설정',permission_required:'권한 추가 필요',misconfigured:'설정 오류',unavailable:'연결 확인 필요'};
  const azureLabel=azureLabels[azure.status]||'상태 미확인';
  const azureCount=Array.isArray(azure.events)?azure.events.length:0;
  const azureCountText=azure.status==='available'?`최근 24시간 · ${azureCount}건${azureCount===0?' · 조회된 기록 없음':''}`:(azure.reason||'출처 상태 미확인');
  setSource('azure',azureLabel,azureCountText,azure.status||'unavailable');
  const integrity=app.integrity||{};
  setSource('integrity',integrity.ok?'연결 이상 없음':'검증 실패',integrity.ok?`앱 체인 ${integrity.checked??0}건 점검`:`사유 ${integrity.reason||'미제공'} · ID ${integrity.failedAuditId||'미제공'}`,integrity.ok?'ok':'failed');
  observatory.querySelector('[data-security-app-count]').textContent=`${appAlerts.length}건`;
  observatory.querySelector('[data-security-vault-count]').textContent=azure.status==='available'?`${azureCount}건`:'—';
  drawSecurityFeed(observatory.querySelector('[data-security-app-alerts]'),appAlerts.slice(0,20),reviews,'APP',appAlerts.length?'최근 접근 거부·실패 이벤트가 없습니다.':'확인이 필요한 앱 이벤트가 없습니다.');
  const vaultEvents=azure.status==='available'&&Array.isArray(azure.events)?azure.events.slice(0,20):[];
  const vaultEmpty=azure.status==='available'?'최근 24시간 조회 결과가 없습니다. 이는 보안 위험이 없다는 판정은 아닙니다.':`Key Vault 감사 출처: ${azureLabel} · ${azure.reason||'설정 또는 권한 확인 필요'}`;
  drawSecurityFeed(observatory.querySelector('[data-security-vault-events]'),vaultEvents,reviews,'AZURE_KEYVAULT',vaultEmpty);
  const detail=document.querySelector('[data-audit-integrity-detail]');
  if(detail)detail.textContent=integrity.ok
    ? `앱 저장소의 ${integrity.checked??0}개 감사 레코드 해시 연결을 확인했습니다. 이 결과는 Azure 불변 보관, 외부 백업, 로그 수집 완전성 또는 시스템 전체 안전성을 증명하지 않습니다.`
    : `앱 해시 연결 검증 실패 또는 미확인 · ${integrity.reason||'근거 없음'}. 원본 기록을 수정하지 말고 저장소와 보관 경로를 조사하세요.`;
}

function drawSecurityFeed(container,events,reviews,source,emptyMessage) {
  if(!container)return;
  container.replaceChildren();
  if(!events.length){const empty=document.createElement('p');empty.className='security-feed-empty';empty.textContent=emptyMessage;container.append(empty);return;}
  for(const event of events) {
    const eventRef=source==='APP'?event.auditId:event.eventRef;
    const review=reviews.get(`${source}|${eventRef}`);
    const card=document.createElement('article');card.className='security-event-card';
    const result=source==='APP'?String(event.result||'UNKNOWN').toUpperCase():String(event.resultType||'UNKNOWN').toUpperCase();
    card.dataset.kind=['DENIED','FAIL','FAILED','ERROR','FAILURE'].includes(result)?'error':source==='APP'?'warning':'success';
    const header=document.createElement('header'),time=document.createElement('time');
    const timestamp=source==='APP'?event.createdAt:event.timeGenerated,date=Date.parse(timestamp);
    time.textContent=Number.isFinite(date)?new Date(date).toLocaleString('ko-KR'):'기록 시각 미확인';
    const badge=document.createElement('span');badge.textContent=source==='APP'?'앱':'Key Vault';header.append(time,badge);
    const title=document.createElement('strong');
    title.textContent=source==='APP'?`${event.action||'앱 이벤트'} · ${result}`:`${event.operationName||'Vault 작업'} · ${result}`;
    const copy=document.createElement('p');copy.textContent=source==='APP'?`사유 ${event.reasonCode||'미제공'} · 기관 ${event.hospitalId||'미확인'}`:`${event.resource||'Key Vault'}${event.resultSignature?` · ${event.resultSignature}`:''} · 참조 ${event.eventRef}`;
    card.append(header,title,copy);
    if(review){const state=document.createElement('span');state.className='security-event-review-state';state.textContent=`검토 ${({REVIEWED:'완료',INVESTIGATING:'중',ACTION_REQUIRED:'조치 필요',FALSE_POSITIVE:'오탐 판정'})[review.status]||'기록 있음'}${review.ticketRef?` · ${review.ticketRef}`:''} · ${review.actorId||'관리자'} · ${Number.isFinite(Date.parse(review.recordedAt))?new Date(review.recordedAt).toLocaleString('ko-KR'):''}`;card.append(state);if(review.note){const note=document.createElement('p');note.textContent=`메모: ${review.note}`;card.append(note);}}
    const disclosure=document.createElement('details'),summary=document.createElement('summary');summary.textContent='검토 상태와 운영 메모 추가';
    const form=document.createElement('form');form.className='security-review-form';form.dataset.securityReview='true';form.dataset.source=source;form.dataset.eventRef=eventRef;
    const statusLabel=document.createElement('label');statusLabel.textContent='검토 상태';const status=document.createElement('select');status.name='status';
    for(const [value,label]of [['REVIEWED','검토 완료'],['INVESTIGATING','조사 중'],['ACTION_REQUIRED','조치 필요'],['FALSE_POSITIVE','오탐으로 판단']])status.add(new Option(label,value));statusLabel.append(status);
    const ticketLabel=document.createElement('label');ticketLabel.textContent='사건·티켓 번호 (선택)';const ticket=document.createElement('input');ticket.name='ticketRef';ticket.maxLength=40;ticket.autocomplete='off';ticket.placeholder='예: SEC-1042';ticketLabel.append(ticket);
    const noteLabel=document.createElement('label');noteLabel.textContent='운영 메모 (선택, 환자 식별정보 금지)';const note=document.createElement('input');note.name='note';note.maxLength=160;note.autocomplete='off';note.placeholder='조사 진행 상황이나 후속 조치만 기록';noteLabel.append(note);
    const submit=document.createElement('button');submit.type='submit';submit.textContent='검토 이력 추가';form.append(statusLabel,ticketLabel,noteLabel,submit);disclosure.append(summary,form);card.append(disclosure);container.append(card);
    form.addEventListener('submit',async eventSubmit=>{
      eventSubmit.preventDefault();if(submit.disabled)return;submit.disabled=true;
      try{await postJson('/api/security/reviews',{source,eventRef,status:status.value,ticketRef:ticket.value,note:note.value});await loadAuditTimeline();}
      catch{showToast('검토 이력을 남기지 못했습니다. 권한·출처 상태를 확인해 주세요.');submit.disabled=false;}
    });
  }
}
function renderAuditTable(logs) {
  const tbody = document.querySelector("#audit-log-rows");
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">기록된 감사로그가 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.slice(0, 20).map((log) => {
    const isSuccess = log.result === "SUCCESS" || log.result === "ALLOWED";
    const badgeClass = isSuccess ? "mq-badge mq-badge-good" : (log.result === "ALERT" ? "mq-badge mq-badge-warn" : "mq-badge mq-badge-bad");
    return `
      <tr>
        <td style="font-family:monospace;font-size:12px;">${escapeHtml(formatDate(log.createdAt || log.timestamp))}</td>
        <td><strong>${escapeHtml(log.action)}</strong></td>
        <td>${escapeHtml(log.actorType || "USER")}:${escapeHtml(log.actorId || "-")}</td>
        <td>${escapeHtml(log.hospitalId || log.targetHospitalId || "-")}</td>
        <td><span class="${badgeClass}">${escapeHtml(log.result)}</span></td>
        <td><code style="font-size:11px;">${escapeHtml(log.reasonCode || log.reason || "OK")}</code></td>
      </tr>
    `;
  }).join("");
}

function renderMetrics(studies, logs, usage) {
  const bytes = usage.reduce((sum, row) => sum + (row.bytesTransferred ?? 0), 0);
  const studiesEl = document.querySelector("#metric-studies");
  const logsEl = document.querySelector("#metric-logs");
  const transferEl = document.querySelector("#metric-transfer");

  if (studiesEl) studiesEl.textContent = studies.length;
  if (logsEl) logsEl.textContent = logs.length;
  if (transferEl) transferEl.textContent = `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderHealth(health) {
  const healthEl = document.querySelector("#metric-health");
  if (healthEl) healthEl.textContent = `${health.status} (DB ${health.database})`;
}

function renderLogs(logs) {
  // Legacy or auxiliary lists
}

function renderAnomalies(logs) {
  const rows = logs.slice(0, 10).map((log) => ({
    title: `${log.action} / ${log.reasonCode ?? log.reason}`,
    detail: `${log.actorId} / ${log.hospitalId ?? "-"} / ${formatDate(log.createdAt)}`,
    tone: "warning",
  }));
  const fallback = [{ title: "이상행위 미감지", detail: "보안 룰 임계치를 초과한 비정상 패턴이 없습니다.", tone: "success" }];
  renderInto("#anomaly-list", rows.length ? rows : fallback);
}

function renderQuarantines(quarantines) {
  const container = document.querySelector("#quarantine-list");
  const countBadge = document.querySelector("#quarantine-count-badge");
  if (!container) return;

  const activeQuarantines = quarantines.filter((q) => q.status === "QUARANTINED");
  if (countBadge) {
    countBadge.textContent = `${activeQuarantines.length}건 격리 중`;
    countBadge.className = activeQuarantines.length > 0 ? "mq-badge mq-badge-bad" : "mq-badge mq-badge-good";
  }

  if (!quarantines.length) {
    container.innerHTML = `
      <div class="action-card">
        <div class="action-symbol" style="--soft:#dcfce7;--tone:#16a34a;">🛡️</div>
        <div>
          <h3>능동 격리된 위협 주체 없음</h3>
          <p>모든 주체 및 IP가 정상 보안 정책 범위 내에서 활동하고 있습니다.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = quarantines.slice(0, 10).map((q) => {
    const isQuarantined = q.status === "QUARANTINED";
    const statusBadge = isQuarantined
      ? '<span class="mq-badge mq-badge-bad">🚨 격리 중 (QUARANTINED)</span>'
      : (q.status === "RELEASED" ? '<span class="mq-badge mq-badge-good">해제됨 (RELEASED)</span>' : '<span class="mq-badge mq-badge-warn">만료됨 (EXPIRED)</span>');

    return `
      <div class="action-card" style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid ${isQuarantined ? '#ef4444' : 'var(--mq-border)'};border-radius:8px;background:${isQuarantined ? 'rgba(239,68,68,0.05)' : 'transparent'};">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="font-size:14px;color:${isQuarantined ? '#dc2626' : 'inherit'};">${escapeHtml(q.actorId)}</strong>
            <small style="color:#64748b;">(${escapeHtml(q.actorType || "ACTOR")}${q.ipAddress ? ` · IP: ${escapeHtml(q.ipAddress)}` : ""})</small>
            ${statusBadge}
          </div>
          <div style="font-size:12px;color:#475569;">
            사유: <strong style="color:#b91c1c;">${escapeHtml(q.reason)}</strong> · 격리일시: ${formatDate(q.quarantinedAt)} · 만료: ${formatDate(q.expiresAt)}
          </div>
          ${q.releasedBy ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">관리자 해제: ${escapeHtml(q.releasedBy)} (${formatDate(q.releasedAt)})</div>` : ""}
        </div>
        <div>
          ${isQuarantined ? `
            <button class="mq-btn small mq-btn-primary" type="button" data-release-quarantine="${escapeHtml(q.quarantineId)}" style="background:#dc2626;border-color:#dc2626;color:#fff;">
              🔓 격리 해제 (Unblock)
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-release-quarantine]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const qid = btn.dataset.releaseQuarantine;
      if (!qid) return;
      btn.disabled = true;
      btn.textContent = "해제 처리 중...";
      try {
        const res = await postJson(`/api/security/quarantines/${encodeURIComponent(qid)}/release`, {
          reason: "ADMIN_CONSOLE_MANUAL_RELEASE",
        });
        if (res?.error) {
          showToast(`격리 해제 실패: ${res.error}`);
        } else {
          showToast("격리가 즉시 해제되었습니다. 해당 주체의 접근이 정상 재개됩니다.");
          await loadDashboard();
        }
      } catch (err) {
        showToast("격리 해제 요청 중 오류가 발생했습니다.");
      }
    });
  });
}

function showBreakGlassModal(doctorId = demo.doctorId) {
  const bodyHtml = `
    <div class="stack" style="gap:12px;">
      <div class="notice" style="border-left:4px solid #f59e0b;background:#fef3c7;color:#92400e;padding:10px 14px;border-radius:4px;font-size:13px;">
        ⚠️ <strong>의료 비상 프로토콜 (Clinical Break-Glass)</strong><br>
        응급실/중환자실 등 생명이 위급한 환자의 진료를 위해 15분간 능동 격리를 임시 해제합니다.
        비상 열람 행위는 보안감사팀에 실시간 통보되며 영구 감사 체인에 기록됩니다.
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">의사 식별자 (Doctor ID)</label>
        <input type="text" id="bg-doctor-id" class="text-input" value="${escapeHtml(doctorId)}" readonly style="background:#f1f5f9;width:100%;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">의사 면허 번호 (Medical License Number) *</label>
        <input type="text" id="bg-license-number" class="text-input" placeholder="예: DOC-LIC-99281" value="DOC-LIC-99281" style="width:100%;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">응급 환자 번호 (Patient ID)</label>
        <input type="text" id="bg-patient-id" class="text-input" value="${escapeHtml(demo.patientId)}" style="width:100%;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">응급 임상 사유 (Clinical Emergency Reason) *</label>
        <textarea id="bg-clinical-reason" class="text-input" rows="2" style="width:100%;" placeholder="예: 급성 뇌출혈 의심 응급 CT 판독 및 혈전용해술 평가">급성 뇌출혈 의심 응급 CT 판독 및 감별진단</textarea>
      </div>
    </div>
  `;

  showModal({
    eyebrow: "Emergency Clinical Override",
    title: "🚨 응급 비상 열람 (Break-Glass) 승인",
    bodyHtml,
    actionsHtml: `
      <button class="btn primary small" id="btn-submit-break-glass" type="button" style="background:#dc2626;border-color:#dc2626;color:#fff;">
        비상 권한 승인 및 임시 해제
      </button>
      <button class="btn secondary small" data-close type="button">취소</button>
    `,
  });

  document.querySelector("#btn-submit-break-glass")?.addEventListener("click", async () => {
    const docId = document.querySelector("#bg-doctor-id")?.value;
    const license = document.querySelector("#bg-license-number")?.value;
    const patientId = document.querySelector("#bg-patient-id")?.value;
    const reason = document.querySelector("#bg-clinical-reason")?.value;

    if (!license || !reason) {
      showToast("면허 번호와 응급 임상 사유를 모두 입력해야 합니다.");
      return;
    }

    try {
      const res = await postJson("/api/security/quarantines/break-glass", {
        doctorId: docId,
        doctorLicenseNumber: license,
        patientId,
        clinicalReason: reason,
        studyInstanceUid: selectedStudyUid || "1.2.410.100.1.20260518.002",
      });

      if (res?.overrideSuccess) {
        closeModal();
        showToast("🚨 응급 비상 열람이 승인되었습니다 (15분간 유효). 즉시 진료를 속개할 수 있습니다.");
        await loadDashboard();
      } else {
        showToast(`비상 열람 승인 실패: ${res?.error || res?.message || "오류"}`);
      }
    } catch (err) {
      showToast("비상 열람 요청 중 오류가 발생했습니다.");
    }
  });
}

function renderAdminShell() {
  const hospitalRows = adminHospitals.map((h) => ({ title: `${h.name} (${h.hospitalId})`, detail: `Status: ${h.status}`, tone: "success" }));
  const gatewayRows = adminGateways.map((g) => ({ title: `${g.gatewayId} (${g.status})`, detail: `${g.hospitalId} -> ${g.endpoint}`, tone: g.status === "ONLINE" ? "success" : "warning" }));
  renderInto("#admin-hospitals-table", hospitalRows);
  renderInto("#admin-gateways-table", gatewayRows);
}

function renderInto(selector, rows) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = rows.map((row) => `
    <div class="action-card">
      <div class="action-symbol" style="--soft:#f1f5f9;--tone:#0f172a;">⚙️</div>
      <div>
        <h3>${escapeHtml(row.title)}</h3>
        <p>${escapeHtml(row.detail)}</p>
      </div>
    </div>
  `).join("");
}

function renderOutput(value) {
  if (output) output.textContent = JSON.stringify(value, (key, item) => {
    if (/^(accessToken|token|nonce|authorization|privateKey|dek|keyEnvelope|encryptedDek)$/i.test(key)) return "[REDACTED]";
    if (typeof item !== "string") return item;
    for (const secret of [latestToken, latestTicketNonce]) {
      if (secret) item = item.replaceAll(secret, "[REDACTED]");
    }
    return item;
  }, 2);
}

// --------------------------------------------------------------------------
// Modal Controls
// --------------------------------------------------------------------------
function closeModal() {
  const modal = document.querySelector("#modal");
  if (modal) modal.hidden = true;
}

function showModal({ eyebrow = "HiPass", title = "상세", bodyHtml = "", actionsHtml = "" }) {
  const modal = document.querySelector("#modal");
  if (!modal) return;
  const eyebrowEl = document.querySelector("#modalEyebrow");
  const titleEl = document.querySelector("#modalTitle");
  const bodyEl = document.querySelector("#modalBody");
  const actionsEl = document.querySelector("#modalActions");
  if (eyebrowEl) eyebrowEl.textContent = eyebrow;
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  if (actionsEl) {
    actionsEl.innerHTML = actionsHtml || '<button class="btn primary small" data-close type="button">닫기</button>';
    actionsEl.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  }
  modal.hidden = false;
}

// --------------------------------------------------------------------------
// Networking & Authentication
// --------------------------------------------------------------------------
async function postJson(path, body) {
  return fetchJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getJson(path, token) {
  return fetchJson(path, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function fetchJson(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const development = developmentPrincipalHeaders(path);
  const mappedRole = capstoneAuth?.roles?.length === 1 ? capstoneAuth.roles[0] : development['x-hipass-role'];
  const principalHeaders = capstoneAuth
    ? (mappedRole && !headers.has("authorization") ? capstoneAuth.headers(mappedRole) : {})
    : development;
  for (const [key, value] of Object.entries(principalHeaders)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  const response = await proofFetch(path, { ...options, headers });
  return safeJson(response);
}

let proofKeyPromise;
let proofPolicyPromise;
function proofBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function proofFetch(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const imageOrigin='https://highpass-images-b.japaneast.cloudapp.azure.com';
  const pacsImport = options.method === 'POST' && /^\/dicomweb\/studies\/[0-9.]{1,64}\/series\/[0-9.]{1,64}\/instances\/[0-9.]{1,64}\/import$/.test(path);
  const viewerImage = (options.method ?? 'GET') === 'GET' && /^\/dicomweb\/studies(?:\/[0-9.]+\/series(?:\/[0-9.]+\/instances(?:\/[0-9.]+\/rendered)?)?)?$/.test(path);
  const externalImage=location.hostname==='highpass-demo.japaneast.cloudapp.azure.com' && (viewerImage || pacsImport);
  const url = new URL(path,externalImage?imageOrigin:location.origin);
  const token = headers.get("authorization")?.split(" ")[1];
  let bound = false;
  if (token) {
    try { bound = Boolean(JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).cnf?.jkt); } catch {}
  }
  if (pacsImport && !bound) throw new Error("PACS_IMPORT_DPOP_REQUIRED");
  const issuance = options.method === "POST" && ["/api/dicom-access/request", "/api/transfers/tickets/redeem-viewer", "/api/transfers/tickets/redeem", "/api/demo/qr/redeem"].includes(url.pathname);
  let bindIssuance = false;
  if (issuance) {
    proofPolicyPromise ??= fetch("/api/security/proof-policy", { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }).then(async (response) => {
      if (!response.ok) throw new Error("접근 증명 정책을 확인하지 못했습니다.");
      return response.json();
    }).catch((error) => { proofPolicyPromise = undefined; throw error; });
    bindIssuance = (await proofPolicyPromise).supported;
  }
  if (bound || bindIssuance) {
    if ((url.origin !== location.origin && !(externalImage&&url.origin===imageOrigin)) || url.protocol !== "https:" || !crypto.subtle) throw new Error("보안 연결에서 접근 증명을 다시 발급해 주세요.");
    proofKeyPromise ??= crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    const key = await proofKeyPromise;
    const jwk = await crypto.subtle.exportKey("jwk", key.publicKey);
    const payload = { jti: crypto.randomUUID(), htm: options.method ?? "GET", htu: `${url.origin}${url.pathname}`, iat: Math.floor(Date.now() / 1000) };
    if (bound) {
      payload.ath = proofBase64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      headers.set("authorization", `DPoP ${token}`);
    }
    const input = `${proofBase64(new TextEncoder().encode(JSON.stringify({ typ: "dpop+jwt", alg: "ES256", jwk })))}.${proofBase64(new TextEncoder().encode(JSON.stringify(payload)))}`;
    const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(input));
    headers.set("dpop", `${input}.${proofBase64(signature)}`);
  }
  const imageDeadline = document.documentElement.dataset.capstone === "1" && url.pathname.startsWith("/dicomweb/") && url.pathname.includes("/instances/") && !url.pathname.endsWith("/metadata");
  return fetch(url.href, { ...options, headers,credentials:externalImage?'omit':options.credentials,redirect:externalImage?'error':options.redirect,cache:externalImage?'no-store':options.cache, signal: options.signal ?? AbortSignal.timeout(imageDeadline ? 35000 : 20000) });
}

function developmentPrincipalHeaders(path) {
  if (!path.startsWith("/api/")) return {};
  if (path === "/api/health") return {};

  if (path.startsWith("/api/v1/me/phr/") || path.startsWith('/api/v1/me/health-helper/')) {
    return {
      "x-hipass-role": "PATIENT",
      "x-hipass-user-id": "synthetic-account-a",
      "x-hipass-patient-id": demo.patientId,
      "x-hipass-session-id": "dev-phr-patient-session",
    };
  }

  if (path === "/api/transfers/tickets/redeem-viewer" || path === "/api/demo/qr/redeem" || path === '/api/clinician/receptions') {
    return {
      "x-hipass-role": "DOCTOR",
      "x-hipass-user-id": demo.doctorId,
      "x-hipass-doctor-id": demo.doctorId,
      "x-hipass-hospital-id": demo.targetHospitalId,
      "x-hipass-session-id": "dev-doctor-handoff-session",
    };
  }

  if (path === "/api/security/quarantines/break-glass") {
    return {
      "x-hipass-role": "DOCTOR",
      "x-hipass-user-id": demo.doctorId,
      "x-hipass-doctor-id": demo.doctorId,
      "x-hipass-hospital-id": demo.targetHospitalId,
      "x-hipass-session-id": "dev-doctor-break-glass-session",
    };
  }

  if (
    path.startsWith("/api/audit-logs") ||
    path.startsWith("/api/anomaly-alerts") ||
    path.startsWith("/api/audit-integrity") ||
    path.startsWith("/api/transfer-usage") ||
    path.startsWith("/api/research/") ||
    path.startsWith("/api/security/")
  ) {
    return {
      "x-hipass-role": "SECURITY_ADMIN",
      "x-hipass-user-id": "SECURITY-ADMIN-001",
      "x-hipass-session-id": "dev-security-session",
    };
  }

  if (
    path.startsWith("/api/dicom-access") ||
    path.startsWith("/api/policies") ||
    path === "/api/transfers/pacs-import" ||
    path.startsWith("/api/hospitals/") ||
    path === "/api/transfers/pacs-archive"
  ) {
    return {
      "x-hipass-role": "DOCTOR",
      "x-hipass-user-id": demo.doctorId,
      "x-hipass-doctor-id": demo.doctorId,
      "x-hipass-hospital-id": demo.targetHospitalId,
      "x-hipass-session-id": "dev-doctor-session",
    };
  }

  if (
    path.startsWith("/api/patients/") ||
    path.startsWith("/api/consents") ||
    path.startsWith("/api/imaging-studies")
  ) {
    return {
      "x-hipass-role": "PATIENT",
      "x-hipass-user-id": "synthetic-account-a",
      "x-hipass-patient-id": demo.patientId,
      "x-hipass-session-id": "dev-patient-session",
    };
  }

  return {
    "x-hipass-role": currentPersona === "DOCTOR" ? "DOCTOR" : "PATIENT",
    "x-hipass-user-id": currentPersona === "DOCTOR" ? demo.doctorId : "synthetic-account-a",
    "x-hipass-doctor-id": demo.doctorId,
    "x-hipass-hospital-id": demo.targetHospitalId,
    "x-hipass-patient-id": demo.patientId,
    "x-hipass-session-id": "dev-generic-session",
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return { error: `HTTP_${response.status}` };
  }
}

// --------------------------------------------------------------------------
// Utilities & Formatters
// --------------------------------------------------------------------------
function dicomValue(row, tag) {
  const value = row?.[tag]?.Value;
  return Array.isArray(value) ? String(value[0] ?? "") : "";
}

function toFriendlyError(code) {
  const messages = {
    PATIENT_CONSENT_REQUIRED: "의료영상 열람을 위해 환자의 유효한 공유 동의가 필요합니다.",
    ACCESS_DENIED_NO_CONSENT: "해당 영상에 대한 유효한 동의 정책이 존재하지 않습니다.",
    CONSENT_REVOKED: "환자가 해당 의료영상의 공유 동의를 철회하였습니다.",
    TOKEN_CONSENT_INACTIVE: "동의 상태가 더 이상 활성(ACTIVE) 상태가 아닙니다.",
    CONSENT_EXPIRED: "동의 유효기간이 만료되었습니다.",
    TOKEN_EXPIRED: "단기 접근토큰 유효기간(5분)이 만료되었습니다. 새 토큰을 요청하세요.",
    HOSPITAL_MISMATCH: "동의된 수신 병원과 요청 병원이 일치하지 않습니다.",
    TOKEN_HOSPITAL_MISMATCH: "발급된 토큰이 요청 병원 범위와 일치하지 않습니다.",
    STUDY_SCOPE_MISMATCH: "요청한 Study가 환자 동의 범위를 벗어납니다.",
    TOKEN_STUDY_MISMATCH: "요청한 Study가 토큰 허용 범위를 벗어납니다.",
    SERIES_SCOPE_MISMATCH: "요청한 Series가 환자 동의 범위를 벗어납니다.",
    TOKEN_SERIES_MISMATCH: "요청한 Series가 토큰 허용 범위를 벗어납니다.",
    DOWNLOAD_NOT_ALLOWED: "환자가 조회 전용(VIEW_ONLY)으로 동의하여 다운로드가 차단되었습니다.",
    TOKEN_PERMISSION_MISMATCH: "토큰 권한 범위를 벗어난 다운로드 요청입니다.",
    TOKEN_INVALID: "접근토큰이 누락되었거나 유효하지 않습니다.",
    PACS_IMPORT_NOT_READY: "B PACS 수신 서비스가 아직 준비되지 않았습니다.",
    PACS_IMPORT_DPOP_REQUIRED: "병원 간 반입에는 DPoP에 결속된 단기 다운로드 권한이 필요합니다.",
    PACS_IMPORT_ORIGIN_OR_METHOD_INVALID: "허용된 의료진 웹 경로에서만 PACS 반입을 요청할 수 있습니다.",
    PACS_IMPORT_BODY_NOT_ALLOWED: "반입 요청에는 영상 본문을 포함할 수 없습니다.",
    DOWNLOAD_TOKEN_DENIED: "현재 동의 범위로 다운로드 권한을 발급할 수 없습니다.",
    VIEW_CONTEXT_CHANGED: "환자 동의 또는 선택한 영상이 변경되어 요청을 중단했습니다.",
    PACS_RECEIPT_INVALID: "B PACS가 반환한 UID·해시 검증 영수증이 올바르지 않습니다.",
    ORTHANC_QIDO_STUDY_FAILED: "Gateway가 Study 메타데이터를 조회하지 못했습니다.",
    ORTHANC_QIDO_SERIES_FAILED: "Gateway가 Series 메타데이터를 조회하지 못했습니다.",
    ORTHANC_QIDO_INSTANCE_FAILED: "Gateway가 Instance 메타데이터를 조회하지 못했습니다.",
    ORTHANC_WADO_INSTANCE_FAILED: "Gateway가 선택된 인스턴스를 스트리밍하지 못했습니다.",
    ORTHANC_UNAVAILABLE: "가상 PACS 의료영상 서버에 일시적으로 연결할 수 없습니다.",
    PHR_PROVIDER_NOT_CONFIGURED: "PHR 프로바이더가 구성되지 않았습니다.",
    PHR_PATIENT_BINDING_MISMATCH: "현재 환자 계정에 인가되지 않은 PHR 요청입니다.",
    PHR_IMAGING_NOT_MAPPED: "승인된 가상 PACS 출처와 매핑되지 않은 영상입니다.",
    PHR_CONSENT_REQUEST_INVALID: "PHR 공유 요청 범위가 올바르지 않습니다.",
    PHR_REQUEST_FAILED: "PHR 데이터를 불러오지 못했습니다.",
    ACTOR_QUARANTINED: "보안 위협 행위(비정상 반복 실패, 만료 토큰 남용 등)로 인해 해당 주체 또는 IP가 격리되어 접근이 차단되었습니다.",
    ACCESS_DENIED_ACTOR_QUARANTINED: "보안 위협 행위 감지로 인해 해당 주체의 접근이 능동 격리 차단되었습니다.",
  };
  return messages[code] ?? "접근 실패: 동의, 단기 토큰, Gateway 상태를 확인하세요.";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { hour12: false });
}

function toDateTimeLocal(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromLocal(value) {
  return new Date(value).toISOString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ==========================================================================
// Patient In-App Medical Imaging Viewer Controller
// Security: VIEW_ONLY enforced, Watermarked, Real-time Self-View Audit
// ==========================================================================
const patientViewerState = {
  study: null,
  currentSlice: 1,
  totalSlices: 1,
  isPlaying: false,
  timer: null,
  preset: "DEFAULT",
  zoom: 1.0,
};

function setupPatientViewerModalEvents() {
  const modal = document.querySelector("#patient-viewer-modal");
  const btnClose = document.querySelector("#btn-close-patient-viewer");
  const btnCloseBottom = document.querySelector("#pv-btn-close-bottom");
  const btnTransfer = document.querySelector("#pv-btn-transfer-now");
  const btnPrev = document.querySelector("#pv-btn-prev");
  const btnNext = document.querySelector("#pv-btn-next");
  const slider = document.querySelector("#pv-slice-slider");
  const btnCine = document.querySelector("#pv-btn-cine");
  const btnReset = document.querySelector("#pv-btn-reset-view");
  const btnZoom = document.querySelector("#pv-btn-zoom");

  const closeViewer = () => {
    if (patientViewerState.timer) clearInterval(patientViewerState.timer);
    patientViewerState.isPlaying = false;
    if (modal) modal.hidden = true;
  };

  btnClose?.addEventListener("click", closeViewer);
  btnCloseBottom?.addEventListener("click", closeViewer);

  btnTransfer?.addEventListener("click", async () => {
    const studyUid = patientViewerState.study?.studyInstanceUid;
    closeViewer();
    if (studyUid) {
      await selectStudy(studyUid, lastStudies);
      const study = lastStudies.find((s) => s.studyInstanceUid === studyUid);
      if (sourceHospitalSelect) sourceHospitalSelect.value = study?.sourceHospitalId || "HOSP-A";
      if (targetHospitalSelect) targetHospitalSelect.value = "HOSP-B";
      if (accessPurposeSelect) accessPurposeSelect.value = "TREATMENT";
      if (accessModeSelect) accessModeSelect.value = "VIEW_ONLY";
      syncPatientChoices({ preserveConsentState: true });
      navigatePatientPage("consent");
      showToast(`[${study?.description || "의료영상"}] 전송 동의 화면으로 이동했습니다.`);
    }
  });

  slider?.addEventListener("input", (e) => {
    patientViewerState.currentSlice = Number(e.target.value);
    drawPatientViewerFrame();
  });

  btnPrev?.addEventListener("click", () => {
    patientViewerState.currentSlice = Math.max(1, patientViewerState.currentSlice - 1);
    updatePatientViewerControls();
  });

  btnNext?.addEventListener("click", () => {
    patientViewerState.currentSlice = Math.min(patientViewerState.totalSlices, patientViewerState.currentSlice + 1);
    updatePatientViewerControls();
  });

  btnCine?.addEventListener("click", togglePatientCinePlayback);

  btnReset?.addEventListener("click", () => {
    patientViewerState.preset = "DEFAULT";
    patientViewerState.zoom = 1.0;
    patientViewerState.currentSlice = 1;
    document.querySelectorAll(".pv-preset-btn").forEach((b) => b.classList.toggle("active", b.dataset.pvPreset === "DEFAULT"));
    if (btnZoom) btnZoom.textContent = "🔍 확대 보기 (1.0x)";
    updatePatientViewerControls();
  });

  btnZoom?.addEventListener("click", () => {
    const zooms = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (zooms.indexOf(patientViewerState.zoom) + 1) % zooms.length;
    patientViewerState.zoom = zooms[nextIdx];
    if (btnZoom) btnZoom.textContent = `🔍 확대 보기 (${patientViewerState.zoom.toFixed(2)}x)`;
    drawPatientViewerFrame();
  });

  document.querySelectorAll(".pv-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pv-preset-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      patientViewerState.preset = btn.dataset.pvPreset;
      drawPatientViewerFrame();
    });
  });

  // Canvas Mouse Wheel Navigation
  const canvas = document.querySelector("#patient-viewer-canvas");
  canvas?.addEventListener("wheel", (e) => {
    if (patientViewerState.totalSlices <= 1) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      patientViewerState.currentSlice = Math.min(patientViewerState.totalSlices, patientViewerState.currentSlice + 1);
    } else {
      patientViewerState.currentSlice = Math.max(1, patientViewerState.currentSlice - 1);
    }
    updatePatientViewerControls();
  }, { passive: false });
}

async function openPatientStudyViewer(studyUid) {
  const study=lastStudies.find(item=>item.studyInstanceUid===studyUid);
  if(!study){showToast('해당 의료영상을 찾을 수 없습니다.');return;}
  if(!capstoneAuth){showToast('본인 영상은 보안 시연 로그인 후 열람할 수 있습니다.');return;}
  try{await openPatientPixelViewer({patientId:demo.patientId,study,headers:capstoneAuth.headers('PATIENT')});}
  catch{showToast('본인 열람 인증을 확인하지 못했습니다. 다시 로그인해 주세요.');}
}

// Retained historical mock controller; not used as a real-viewer fallback.
async function openRetiredIllustrativePatientViewer(studyUid) {
  const study = lastStudies.find((s) => s.studyInstanceUid === studyUid);
  if (!study) {
    showToast("해당 의료영상을 찾을 수 없습니다.");
    return;
  }

  // 1. Audit log on server (PATIENT_SELF_VIEW)
  try {
    await postJson(`/api/patients/${demo.patientId}/studies/${encodeURIComponent(studyUid)}/self-view`, {});
  } catch (err) {
    showToast("열람 승인을 확인하지 못했습니다. 다시 로그인한 뒤 시도하세요.");
    return;
  }

  // 2. Setup state
  patientViewerState.study = study;
  // This canvas is a single illustrative frame, not retrieved DICOM Instances.
  patientViewerState.totalSlices = 1;
  patientViewerState.currentSlice = 1;
  patientViewerState.isPlaying = false;
  patientViewerState.preset = "DEFAULT";
  patientViewerState.zoom = 1.0;
  if (patientViewerState.timer) clearInterval(patientViewerState.timer);

  // 3. UI Update
  const modal = document.querySelector("#patient-viewer-modal");
  const title = document.querySelector("#patientViewerTitle");
  const sub = document.querySelector("#patientViewerSub");
  const modBadge = document.querySelector("#patientViewerModality");
  const findingDesc = document.querySelector("#pv-finding-desc");
  const slider = document.querySelector("#pv-slice-slider");
  const btnPrev = document.querySelector("#pv-btn-prev");
  const btnNext = document.querySelector("#pv-btn-next");
  const btnCine = document.querySelector("#pv-btn-cine");

  if (title) title.textContent = `[모의 미리보기 · 실제 DICOM 아님] ${study.description}`;
  if (sub) sub.innerHTML = `출처: <strong>${escapeHtml(study.sourceHospitalId)}</strong> · 검사일자: ${escapeHtml(study.studyDate)} · <span class="badge">${escapeHtml(study.modality)}</span>`;
  if (modBadge) modBadge.textContent = study.modality || "DICOM";

  if (slider) {
    slider.min = "1";
    slider.max = String(patientViewerState.totalSlices);
    slider.value = "1";
    slider.disabled = patientViewerState.totalSlices <= 1;
  }
  if (btnPrev) btnPrev.disabled = patientViewerState.totalSlices <= 1;
  if (btnNext) btnNext.disabled = patientViewerState.totalSlices <= 1;
  if (btnCine) {
    btnCine.textContent = "▶ 동영상 연속재생 (Cine)";
    btnCine.disabled = patientViewerState.totalSlices <= 1;
  }

  if (findingDesc) {
    const mod = (study.modality || "").toUpperCase();
    const desc = (study.description || "").toUpperCase();
    if (mod === "CT" || desc.includes("CHEST CT")) {
      findingDesc.innerHTML = "<strong>우측 폐 상엽 미세 결절 소견:</strong> 이전 검진 대비 크기 변화 미미함. 흉부 임파선 종대 없음 (6개월 후 저선량 CT 추적 권고).";
    } else if (mod === "MR" || desc.includes("BRAIN")) {
      findingDesc.innerHTML = "<strong>급성 뇌경색 병변 없음:</strong> 뇌실질 및 대뇌 혈관 정상 윤곽 유지. 경추 C5-6 디스크 경미한 퇴행성 팽륜 소견 관찰.";
    } else if (mod === "CR" || desc.includes("X-RAY")) {
      findingDesc.innerHTML = "<strong>흉부 단순촬영 정상 소견:</strong> 양측 폐야에 활동성 병변 및 삼출액 없음. 심장 음영 정상 범위.";
    } else {
      findingDesc.innerHTML = "<strong>관절 연골 및 골격 소견:</strong> 골절 소견 없음. 연부조직 부종 미미함.";
    }
    findingDesc.textContent = "시연용 예시 설명입니다. 실제 영상 판독이나 진단 결과가 아닙니다.";
  }

  if (modal) {
    modal.hidden = false;
  }

  updatePatientViewerControls();
  showToast(`[${study.description}] 모의 미리보기입니다. 환자 본인 실제 영상 연결은 아직 미구현입니다.`);
}

function updatePatientViewerControls() {
  const slider = document.querySelector("#pv-slice-slider");
  if (slider) slider.value = String(patientViewerState.currentSlice);
  const badge = document.querySelector("#pv-slice-badge");
  if (badge) badge.textContent = `${patientViewerState.currentSlice} / ${patientViewerState.totalSlices}`;
  const hudSlice = document.querySelector("#pv-hud-slice");
  if (hudSlice) hudSlice.textContent = `모의 프레임 ${patientViewerState.currentSlice} / ${patientViewerState.totalSlices}`;
  drawPatientViewerFrame();
}

function togglePatientCinePlayback() {
  if (patientViewerState.totalSlices <= 1) return;
  const btnCine = document.querySelector("#pv-btn-cine");
  if (patientViewerState.isPlaying) {
    if (patientViewerState.timer) clearInterval(patientViewerState.timer);
    patientViewerState.isPlaying = false;
    if (btnCine) btnCine.textContent = "▶ 동영상 연속재생 (Cine)";
  } else {
    patientViewerState.isPlaying = true;
    if (btnCine) btnCine.textContent = "⏸ 일시정지";
    patientViewerState.timer = setInterval(() => {
      patientViewerState.currentSlice = patientViewerState.currentSlice >= patientViewerState.totalSlices ? 1 : patientViewerState.currentSlice + 1;
      updatePatientViewerControls();
    }, 85);
  }
}

function drawPatientViewerFrame() {
  const canvas = document.querySelector("#patient-viewer-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const slice = patientViewerState.currentSlice;
  const total = patientViewerState.totalSlices;
  const study = patientViewerState.study;
  const mod = (study?.modality || "CT").toUpperCase();
  const preset = patientViewerState.preset;
  const zoom = patientViewerState.zoom || 1.0;

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = preset === "INVERT" ? "#ffffff" : "#05070a";
  ctx.fillRect(0, 0, w, h);

  // Apply Zoom around center
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  const progress = slice / Math.max(1, total);

  if (mod === "CR") {
    drawSyntheticChestXray(ctx, w, h, preset);
  } else if (mod === "MR") {
    drawSyntheticBrainMri(ctx, w, h, progress, preset);
  } else {
    drawSyntheticBodyCt(ctx, w, h, progress, preset);
  }

  ctx.restore();

  // Draw HUD Watermark overlay (not affected by zoom)
  ctx.save();
  ctx.fillStyle = preset === "INVERT" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.22)";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${patientViewerState.study?.sourceHospitalId ?? "출처 미확인"} · ${demo.patientId} · 모의 그림 (DICOM 아님)`, w / 2, h - 14);
  ctx.restore();
}

function drawSyntheticChestXray(ctx, w, h, preset) {
  const invert = preset === "INVERT";
  const ribColor = invert ? "rgba(40,40,40,0.7)" : "rgba(220,225,235,0.7)";
  const spineColor = invert ? "rgba(20,20,20,0.85)" : "rgba(240,245,255,0.85)";
  const lungColor = invert ? "#eaeaea" : "#111822";
  const heartColor = invert ? "rgba(60,60,60,0.6)" : "rgba(180,190,210,0.6)";

  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = invert ? "#f5f5f5" : "#0d131d";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(w * 0.35, h * 0.45, w * 0.14, h * 0.28, -0.05, 0, Math.PI * 2);
  ctx.ellipse(w * 0.65, h * 0.45, w * 0.14, h * 0.28, 0.05, 0, Math.PI * 2);
  ctx.fillStyle = lungColor;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(w * 0.47, h * 0.53, w * 0.12, h * 0.16, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = heartColor;
  ctx.fill();

  ctx.fillStyle = spineColor;
  ctx.fillRect(w / 2 - 8, h * 0.12, 16, h * 0.72);

  ctx.strokeStyle = ribColor;
  ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const y = h * 0.25 + i * 26;
    ctx.beginPath();
    ctx.arc(w * 0.34, y, 42, Math.PI * 0.8, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.66, y, 42, Math.PI * 1.1, Math.PI * 0.2);
    ctx.stroke();
  }
}

function drawSyntheticBrainMri(ctx, w, h, progress, preset) {
  const invert = preset === "INVERT";
  const cx = w / 2;
  const cy = h / 2;
  const skullRadius = Math.sin(progress * Math.PI) * (w * 0.38) + 30;

  ctx.strokeStyle = invert ? "rgba(30,30,30,0.8)" : (preset === "BONE" ? "#ffffff" : "rgba(220,230,245,0.75)");
  ctx.lineWidth = preset === "BONE" ? 7 : 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, skullRadius, skullRadius * 1.15, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = invert ? "rgba(100,100,100,0.5)" : (preset === "BRAIN" ? "rgba(140,155,185,0.75)" : "rgba(110,125,150,0.6)");
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(10, skullRadius - 8), Math.max(10, skullRadius * 1.15 - 8), 0, 0, Math.PI * 2);
  ctx.fill();

  const ventSize = Math.sin(progress * Math.PI) * 22;
  if (ventSize > 5) {
    ctx.fillStyle = invert ? "#ffffff" : "#080c14";
    ctx.beginPath();
    ctx.ellipse(cx - 14, cy - 8, ventSize * 0.45, ventSize, 0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 14, cy - 8, ventSize * 0.45, ventSize, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = invert ? "rgba(200,200,200,0.4)" : "rgba(20,30,45,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - skullRadius);
  ctx.lineTo(cx, cy + skullRadius);
  ctx.stroke();
}

function drawSyntheticBodyCt(ctx, w, h, progress, preset) {
  const invert = preset === "INVERT";
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = invert ? "#e8e8e8" : "#121a24";
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = invert ? "#111" : (preset === "BONE" ? "#ffffff" : "#d8e2ec");
  ctx.lineWidth = preset === "BONE" ? 6 : 3.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.40, h * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = invert ? "#000" : "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.24, 14, 0, Math.PI * 2);
  ctx.fill();

  const lungOpacity = preset === "LUNG" ? 0.95 : 0.6;
  ctx.fillStyle = invert ? "#ffffff" : `rgba(4, 7, 12, ${lungOpacity})`;
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.18, cy - 10, w * 0.15, h * 0.20, 0.05, 0, Math.PI * 2);
  ctx.ellipse(cx + w * 0.18, cy - 10, w * 0.15, h * 0.20, -0.05, 0, Math.PI * 2);
  ctx.fill();

  if (Math.abs(progress - 0.5) < 0.15) {
    ctx.fillStyle = invert ? "#b91c1c" : (preset === "LUNG" ? "#38bdf8" : "#f59e0b");
    ctx.beginPath();
    ctx.arc(cx + w * 0.20, cy - 15, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Initialize only after every module-level state binding is initialized.
// Event handlers and heartbeat callbacks may run while the initial dashboard
// awaits network I/O; they must not encounter uninitialized proof/viewer state.
initializePatientComponents();
receptionHome=initializeReceptionHome(document.querySelector('.share-reception'),()=>currentPersona==='DOCTOR');
walletHome=createWalletHome({root:document.querySelector('#patient-portal-app [data-page="home"]'),navigate:route=>{
  navigatePatientPage(({records:'phr',history:'activity',requests:'visit'})[route]||route);
  document.querySelector('#patient-main')?.scrollIntoView({block:'start'});
  const destination=document.querySelector('#patient-portal-app [data-page]:not([hidden])');
  destination?.classList.add('mq-wallet-screen-enter');
  const heading=destination?.querySelector('h1,h2');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
  setTimeout(()=>destination?.classList.remove('mq-wallet-screen-enter'),280);
}});
healthSharePicker=createHealthSharePicker(document.querySelector('#share-health-picker'),{onChange:()=>shareReview?.refresh()});
clinicianHealth=createClinicianHealth(document.querySelector('#clinician-health-records'),{
  headers:()=>capstoneAuth?.headers('DOCTOR'),available:()=>currentPersona==='DOCTOR'&&Boolean(capstoneAuth?.roles?.includes('DOCTOR')),
  onImages:()=>navigateHospitalScreen('studies')});
window.addEventListener('pagehide',()=>clinicianHealth.reset());
syntheticHealthClient=createHealthRecordClient({headers:()=>capstoneAuth?.headers('PATIENT'),
  available:()=>currentPersona==='PATIENT'&&Boolean(capstoneAuth?.context.scenario),
  onChange:records=>{healthSharePicker.update(records);shareReview?.refresh();patientHealth?.update(lastStudies,Boolean(capstoneAuth?.context.scenario),records);patientHelper?.refresh();refreshWalletHome();}});
patientHelper=createPatientHelper(document.querySelector('#patient-health-helper'), {navigate:navigatePatientPage,
  getRecords:()=>healthRecords(lastStudies,Boolean(capstoneAuth?.context.scenario),syntheticHealthClient.records()),
  getComparisons:()=>syntheticHealthClient.records(),recordStatus:()=>syntheticHealthClient.status(),retryRecords:()=>syntheticHealthClient.load(),
  ask:async(question,{signal})=>{const result=await fetchJson('/api/v1/me/health-helper/questions',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question}),signal
  });if(result.error)throw new Error(result.error);return result;}});
createHelperSurface(document.querySelector('#patient-health-helper'),route=>navigatePatientPage(({records:'phr',requests:'visit'})[route]||route));
faqAssistant=createFaqAssistant({root:document.querySelector('#patient-portal-app'),navigate:navigatePatientPage,available:()=>currentPersona==='PATIENT'});
initNavigation();
initConsentDateDefaults();
shareReview = createShareReview({root:document.querySelector('[data-page="consent"]'), onBack:()=>navigatePatientPage('home'), read:()=>({
  study:patientStudySnapshotAvailable ? lastStudies.find(row=>row.studyInstanceUid===patientStudySelect?.value) : null, seriesUid:patientSeriesSelect?.value,
  source:sourceHospitalSelect?.value, target:targetHospitalSelect?.value, purpose:accessPurposeSelect?.value,
  permission:accessModeSelect?.value, from:consentValidFromInput?.value, until:consentValidUntilInput?.value,
  healthRecordIds:healthSharePicker.ids(),healthRecordTitles:healthSharePicker.titles(),
  patientName:demo.patientName, consent:selectConsentForStudy(lastConsents,{studyUid:patientStudySelect?.value,targetHospitalId:targetHospitalSelect?.value,preferredConsentId:latestConsentId})
})});
shareReview.refresh();
createSharingSurface(document.querySelector('[data-page="sharing"]'),route=>navigatePatientPage(({records:'phr',requests:'visit'})[route]||route));
patientSharing = createPatientSharing({root:document.querySelector('[data-page="sharing"]'),
  onPrepare: (study, target, draft) => {
    if (consentMutationPending || !sharingDraftModel({...draft,study,target}).valid) return;
    selectStudy(study.studyInstanceUid, lastStudies);
    sourceHospitalSelect.value=study.sourceHospitalId; targetHospitalSelect.value=target;
    accessPurposeSelect.value=draft.purpose; accessModeSelect.value=draft.permission;
    consentValidFromInput.value=draft.from; consentValidUntilInput.value=draft.until;
    latestTicketNonce=null; latestConsentId=null; updateVisitModePacket(null);
    syncPatientChoices(); updateConsentState(lastConsents); consentViewRevision++;
    document.querySelector('#share-review-ack').checked=false;
    navigatePatientPage('consent');
  },
  onRevoke: async id => {
    const consent=lastConsents.find(row=>row.consentId===id);
    if (consentMutationPending || !consent || !window.confirm('이 공유를 중단할까요? 이후 접근이 차단됩니다. 이미 열람하거나 허용된 방식으로 저장한 자료까지 회수되지는 않습니다.')) return;
    latestConsentId=id; consentViewRevision++;
    await revokePatientConsent();
  }
});
renderAdminShell();
patientHistory=createPatientHistory({root:document.querySelector('[data-page="activity"]'),onManage:()=>navigatePatientPage('sharing'),onRefresh:()=>loadDashboard()});
clinicianHome=createClinicianHome(document.querySelector('#clinical-home'),{
  onSelect:uid=>selectStudy(uid), onOpen:openClinicianHomeViewer, onRefresh:()=>loadDashboard()
});
async function selectReceptionContext(receipt,study){
    if(!receipt.consent||receipt.status!=='CONSENT_ACTIVE')throw Error('CONSENT_UNAVAILABLE');
    if(receipt.patientId!==demo.patientId||!receipt.studies.some(s=>s.studyInstanceUid===study.studyInstanceUid))throw Error('PATIENT_CONTEXT_MISMATCH');
    lastStudies=[study,...lastStudies.filter(s=>s.studyInstanceUid!==study.studyInstanceUid)];
    lastConsents=[receipt.consent,...lastConsents.filter(c=>c.consentId!==receipt.consentId)];
    latestConsentId=receipt.consentId;
    demo.purpose=receipt.consent.purpose;demo.targetHospitalId=receipt.targetHospitalId;
    if(accessPurposeSelect)accessPurposeSelect.value=receipt.consent.purpose;
    clinicianHealth?.selectReception(receipt.consentId);
    await selectStudy(study.studyInstanceUid);
    renderDoctorStudies(lastStudies);
    const context=document.querySelector('#reception-context');
    if(context){context.hidden=false;context.textContent=`${demo.patientName||receipt.patientId} · ${study.description||study.modality||'공유 검사'} · ${receipt.consent.permission==='DOWNLOAD_ALLOWED'?'다운로드 허용':'열람만 허용'}`;}
}
receptionDesk=createReceptionDesk(document.querySelector('#clinical-home'),{
  read:()=>fetchJson('/api/clinician/receptions',{cache:'no-store'}),
  patientLabel:id=>id===demo.patientId?demo.patientName:id,
  active:()=>currentPersona==='DOCTOR',navigate:navigateHospitalScreen,
  select:selectReceptionContext
});
demoTools=initializeDemoTools({
  read:()=>({persona:currentPersona,roles:capstoneAuth?.roles??(demoEnvironment(location.hostname)==='LOCAL'?['PATIENT','DOCTOR']:[]),
    environment:demoEnvironment(location.hostname),ready:walletSnapshotReady,seriesUid:selectedSeriesUid,
    study:lastStudies.find(s=>s.studyInstanceUid===selectedStudyUid),consent:getConsentForStudy(selectedStudyUid,lastConsents)}),
  refresh:()=>loadDashboard(),
  execute:async id=>{
    const patientRoutes={'patient-home':'home',records:'phr',sharing:'sharing',history:'activity'};
    if(patientRoutes[id]){if(currentPersona!=='PATIENT')switchPersona('PATIENT');navigatePatientPage(patientRoutes[id]);return;}
    if(id==='simulate'){
      navigateHospitalScreen('qr');await simulateQrScan();return;
    }
    if(currentPersona==='PATIENT')switchPersona('DOCTOR');
    navigateHospitalScreen(({'doctor-home':'dashboard','clinical-records':'records',qr:'qr',pacs:'pacs-archive',journey:'exchange',audit:'audit',admin:'admin'})[id]);
  }
});
bindEvents();
await loadDashboard().catch(() => {});
if (pendingPhrHandoffNonce) {
  await redeemPhrHandoff(pendingPhrHandoffNonce);
}

// Expose app controller interface for Video Showcase & Automated Testing
window.app = {
  switchPersona,
  navigatePatientPage,
  navigateHospitalScreen,
  openPatientStudyViewer,
  selectStudy,
  loadDashboard,
  demo,
};
