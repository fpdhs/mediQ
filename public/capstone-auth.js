import { mountDemoEntry } from './ui/demo-entry.js';
import { isSecurityAdminSession, loginHomePath, loginIntentFromSearch, requiresEntra } from './login-navigation.js';
import { createEntraRedirectLogin, validateEntraBrowserConfig } from './entra-auth.js';
// Presenter key and actor JWTs remain in memory. No URL/localStorage/sessionStorage.
export function requireCapstoneScenario(status, config) {
  if (status === 401 || status === 403) throw new Error('LOGIN_PREFLIGHT_DENIED');
  if (status === 404) throw new Error('LOGIN_RUNTIME_NOT_READY');
  if (status !== 200 || !config || typeof config.mainScenario !== 'boolean' || config.synthetic !== true) {
    throw new Error('SCENARIO_UNAVAILABLE');
  }
  return config;
}

function renderPatientAccount(session, mobile) {
  if (!session?.roles?.includes('PATIENT') || !session.context?.patientName) return;
  const { patientName, scenario } = session.context;
  const age = Number.isInteger(scenario?.age) ? `${scenario.age}세` : scenario ? '56세' : '';
  const displayName = patientName;
  const authMethod = session.provider === 'ENTRA_OIDC' ? 'Microsoft 계정' : '합성 시연 인증';

  if (mobile) {
    const profileName = document.querySelector('#wallet-profile-name');
    if (profileName) profileName.textContent = [displayName, age, '합성 환자'].filter(Boolean).join(' · ');
    const profileCaption = document.querySelector('#tab-profile > p:nth-of-type(2)');
    if (profileCaption) profileCaption.textContent = `${authMethod} · 환자 계정 · 합성 시연 환경`;
    const logout = document.querySelector('#btn-lock-app');
    if (logout) {
      logout.textContent = '로그아웃';
      logout.setAttribute('aria-label', '로그아웃하고 Medi Q 시작 화면으로 이동');
    }
    return;
  }

  const oldProfile = document.querySelector('#patient-portal-app .profile');
  if (!oldProfile) return;
  const host = document.createElement('div');
  host.className = 'profile-menu';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'profile-menu-trigger';
  trigger.id = 'patient-profile-toggle';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'patient-profile-panel');
  trigger.setAttribute('aria-label', '내 정보와 로그아웃');
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = displayName.trim().slice(0, 1) || '환';
  const copy = document.createElement('span');
  copy.className = 'profile-menu-copy';
  const name = document.createElement('strong');
  name.textContent = displayName;
  const hint = document.createElement('small');
  hint.textContent = '내 정보 · 로그아웃';
  copy.append(name, hint);
  const chevron = document.createElement('span');
  chevron.className = 'profile-menu-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '⌄';
  trigger.append(avatar, copy, chevron);

  const panel = document.createElement('section');
  panel.className = 'profile-menu-panel';
  panel.id = 'patient-profile-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '내 정보');
  const panelTitle = document.createElement('h2');
  panelTitle.textContent = '내 정보';
  const syntheticBadge = document.createElement('span');
  syntheticBadge.className = 'profile-menu-badge';
  syntheticBadge.textContent = '합성 시연 계정';
  const details = document.createElement('dl');
  for (const [label, value] of [
    ['이름', [displayName, age].filter(Boolean).join(' · ')],
    ['계정 유형', '환자 계정'],
    ['로그인', authMethod],
  ]) {
    const row = document.createElement('div');
    row.className = 'profile-menu-row';
    const term = document.createElement('dt'); term.textContent = label;
    const description = document.createElement('dd'); description.textContent = value;
    row.append(term, description); details.append(row);
  }
  const note = document.createElement('p');
  note.className = 'profile-menu-note';
  note.textContent = '시연용 가상 계정입니다.';
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'profile-menu-logout';
  logout.textContent = '로그아웃';
  logout.addEventListener('click', () => {
    document.documentElement.removeAttribute('data-auth-ready');
    location.replace(loginHomePath(location.pathname));
  });
  panel.append(panelTitle, syntheticBadge, details, note, logout);
  host.append(trigger, panel);
  oldProfile.replaceWith(host);

  const close = ({ restoreFocus = false } = {}) => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };
  trigger.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });
  document.addEventListener('pointerdown', event => {
    if (!host.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      close({ restoreFocus: true });
    }
  });
}

export async function initializeCapstoneAuth() {
  if (document.documentElement.dataset.capstone !== "1") return null;
  const form = document.createElement("form");
  form.id = "capstone-login";
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/ui/capstone-login.css'; document.head.append(style);
  form.innerHTML = `<div class="mediq-login-shell"><section class="mediq-wallet-story" aria-label="내 의료영상 지갑">
    <a class="mediq-wallet-wordmark" href="/hipass/" aria-label="Medi Q 홈">Medi <span>Q</span></a>
    <div class="mediq-wallet-copy"><h1>내 영상은,<br>내가 챙길게요.</h1><p>다음 진료를 위한 첫 걸음.</p></div>
    <p class="mediq-wallet-caption">홍길동 · 56세의 가상 시연</p>
  </section><section class="mediq-login-story">
    <a class="mediq-login-brand" href="/hipass/" aria-label="Medi Q 홈"><span class="mediq-login-logo" role="img" aria-label="Medi Q"></span></a>
    <span class="mediq-login-tag">합성 환자 시연</span><h1>내 영상을 가지고,<br>다음 진료로.</h1>
    <p class="mediq-login-intro">다시 찍기 전에, 내가 찍은 CT를 안전하게 연결하세요.</p>
    <div class="mediq-login-patient"><span class="mediq-login-avatar" aria-hidden="true">Q</span><div><strong>내 의료영상</strong><p>내가 확인하고, 내가 승인하는 공유</p></div><span class="mediq-login-exam">Medi Q</span></div>
    <div class="mediq-login-journey"><div><span>검사한 병원</span><strong>A대학병원</strong></div><span aria-hidden="true">→</span><div><span>다음 진료</span><strong>B대학병원</strong></div></div>
    <p class="mediq-login-note">합성 데이터만 사용하는 캡스톤 시연입니다. 실제 본인확인·병원 인증 서비스가 아닙니다.</p>
  </section><section class="mediq-login-entry" aria-labelledby="mediq-login-title"><span class="mediq-wallet-label">환자 로그인</span><h2 id="mediq-login-title">다음 진료를 준비해요.</h2><p>로그인하고 내 영상과 공유 요청을 확인하세요.</p>
    <div id="mediq-account-fields"><label for="capstone-login-username">아이디</label><input id="capstone-login-username" name="username" autocomplete="username" maxlength="32" required placeholder="아이디를 입력하세요" autocapitalize="none" spellcheck="false">
    <label for="capstone-login-password">비밀번호</label><input id="capstone-login-password" name="password" type="password" autocomplete="current-password" maxlength="128" required placeholder="비밀번호를 입력하세요"></div>
    <label class="mediq-presenter-toggle"><input id="mediq-presenter-mode" type="checkbox"> 발표자·의료진 시연 접근 키 사용</label>
    <div id="mediq-presenter-fields" hidden>
    <div class="mediq-login-roles" aria-label="시연 시작 화면"><button type="button" data-entry-role="PATIENT" aria-pressed="true" class="is-active">환자</button><button type="button" data-entry-role="DOCTOR" aria-pressed="false">의료진</button></div>
    <p id="capstone-entry-description" class="mediq-login-role-description">홍길동님의 CT를 확인하고 B대학병원에 공유합니다.</p>
    <div id="capstone-legacy-profiles" hidden><label for="capstone-patient-profile">시연 환자</label><select id="capstone-patient-profile"><option value="HCC_SYNTHETIC">홍길동 · 56세 · 복부 CT</option></select></div>
    <label for="capstone-login-key">시연 접근 키</label><input id="capstone-login-key" type="password" autocomplete="off" disabled maxlength="128" placeholder="발표자에게 받은 접근 키" aria-describedby="capstone-login-help"></div>
    <p id="capstone-login-help" class="mediq-login-help">환자 시연 계정으로 로그인합니다. 실제 개인정보를 입력하지 마세요.</p><button class="btn primary mediq-login-submit" type="submit" disabled>로그인</button>
    <button type="button" id="mediq-signup-open" class="mediq-login-text-button">처음이신가요? 회원가입</button>
    <div class="mediq-social" aria-describedby="mediq-social-note"><p id="mediq-social-note">간편 로그인 · 연동 준비 중</p><button type="button" disabled>Google로 계속하기 · 준비 중</button><button type="button" disabled>네이버로 계속하기 · 준비 중</button><button type="button" disabled>카카오로 계속하기 · 준비 중</button></div>
    <dialog id="mediq-signup" aria-labelledby="mediq-signup-title"><h2 id="mediq-signup-title">Medi Q 회원가입</h2><p>가입 화면 미리보기입니다. 현재 계정은 생성되지 않으며 입력 내용은 전송·저장하지 않습니다. 실제 개인정보를 입력하지 마세요.</p><fieldset disabled><label for="mediq-signup-id">아이디</label><input id="mediq-signup-id" placeholder="사용할 아이디"><label for="mediq-signup-password">비밀번호</label><input id="mediq-signup-password" type="password" autocomplete="new-password"><label for="mediq-signup-confirm">비밀번호 확인</label><input id="mediq-signup-confirm" type="password" autocomplete="new-password"><button type="button" class="mediq-login-submit" disabled>회원가입 · 준비 중</button></fieldset><button type="button" id="mediq-signup-close" class="mediq-login-text-button">로그인으로 돌아가기</button></dialog>
    <p id="capstone-login-error" role="alert"></p><p class="mediq-login-footer">환자 승인 · 범위가 정해진 공유 · 암호화된 연결</p>
  </section></div>`;
  const securityFlow = document.createElement('section');
  securityFlow.className = 'mediq-security-auth-flow';
  securityFlow.hidden = true;
  securityFlow.setAttribute('aria-label', '보안 운영자 로그인 절차');
  const securitySteps = document.createElement('ol');
  for (const [index, label] of ['Microsoft 인증', '권한 확인', '보안 관제'].entries()) {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'mediq-security-step-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('strong');
    title.textContent = label;
    item.append(number, title);
    securitySteps.append(item);
  }
  const securityNote = document.createElement('p');
  securityNote.textContent = '보안 운영자 권한이 확인된 계정만 입장할 수 있습니다.';
  securityFlow.append(securitySteps, securityNote);
  form.querySelector('.mediq-login-entry').insertBefore(securityFlow, form.querySelector('#mediq-signup-open'));
  const inactive = [...document.body.children].map(node => [node, node.inert]);
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  for (const [node] of inactive) node.inert = true;
  for (const link of form.querySelectorAll('a[href="/hipass/"]')) link.setAttribute('href', loginHomePath(location.pathname));
  document.body.append(form);
  const mobile = location.pathname.startsWith('/mobile');
  if (mobile) {
    form.classList.add('mediq-mobile-login');
    const entry = form.querySelector('.mediq-login-entry');
    const brand = form.querySelector('.mediq-login-brand');
    entry.prepend(brand);
    const presenterDetails = document.createElement('details');
    presenterDetails.className = 'mediq-login-advanced';
    const summary = document.createElement('summary');
    summary.textContent = '발표자 접근 설정';
    presenterDetails.append(summary, form.querySelector('.mediq-presenter-toggle'), form.querySelector('#mediq-presenter-fields'));
    entry.append(presenterDetails);
    form.querySelector('.mediq-login-footer').textContent = '합성 환자 시연 · 실제 본인확인 서비스가 아닙니다.';
    form.querySelectorAll('.mediq-social button').forEach((button, index) => {
      button.textContent = ['Google', '네이버', '카카오'][index];
      button.setAttribute('aria-label', `${button.textContent} 로그인 · 연동 준비 중`);
    });
  }
  let securityLoginIntent = !mobile && loginIntentFromSearch(location.search) === 'SECURITY_ADMIN';
  let entryRole = !mobile && /^(?:#DOCTOR|#doctor)$/.test(location.hash) ? 'DOCTOR' : 'PATIENT';
  let entraMode = false;
  let authPending = true;
  const submit = form.querySelector('[type="submit"]');
  const select = form.querySelector('select');
  const presenterMode = form.querySelector('#mediq-presenter-mode');
  presenterMode.checked = entryRole === 'DOCTOR';
  const username = form.querySelector('#capstone-login-username');
  const password = form.querySelector('#capstone-login-password');
  const key = form.querySelector('#capstone-login-key');
  const walletTitle = form.querySelector('.mediq-wallet-copy h1');
  const walletDescription = form.querySelector('.mediq-wallet-copy p');
  const walletCaption = form.querySelector('.mediq-wallet-caption');
  const walletLabel = form.querySelector('.mediq-wallet-label');
  const loginIntro = form.querySelector('#mediq-login-title').nextElementSibling;
  function applySecurityLoginMode(enabled) {
    form.classList.toggle('mediq-security-login', enabled);
    securityFlow.hidden = !enabled;
    const back = form.querySelector('.mediq-login-back');
    if (back) back.textContent = enabled ? '환자·의료진 로그인으로 돌아가기' : '시작 화면으로';
    if (enabled) {
      walletTitle.replaceChildren('안전한 진료를', document.createElement('br'), '지키는 자리.');
      walletDescription.textContent = '시스템 접근과 감사 기록을 함께 살펴요.';
      walletCaption.textContent = 'Medi Q · 보안 운영';
      walletLabel.textContent = '보안 운영 전용';
      form.querySelector('#mediq-login-title').textContent = '보안 운영자 입구';
      loginIntro.textContent = '시스템 접근과 감사 기록을 관리합니다.';
      form.querySelector('#capstone-login-help').textContent = 'Microsoft 계정 인증 뒤 서버가 보안 운영자 권한을 확인합니다.';
      form.querySelector('.mediq-login-footer').textContent = '접속과 주요 작업은 감사 기록에 남습니다.';
      submit.textContent = 'Microsoft 계정으로 계속';
    } else {
      walletTitle.replaceChildren('내 영상은,', document.createElement('br'), '내가 챙길게요.');
      walletDescription.textContent = '다음 진료를 위한 첫 걸음.';
      walletCaption.textContent = '홍길동 · 56세의 가상 시연';
      walletLabel.textContent = '환자 로그인';
      form.querySelector('.mediq-login-footer').textContent = mobile
        ? '합성 환자 시연 · 실제 본인확인 서비스가 아닙니다.'
        : '환자 승인 · 범위가 정해진 공유 · 암호화된 연결';
    }
  }
  const signup = form.querySelector('#mediq-signup');
  form.querySelector('#mediq-signup-open').addEventListener('click', () => signup.showModal());
  form.querySelector('#mediq-signup-close').addEventListener('click', () => signup.close());
  function applyMode() {
    const presenter = presenterMode.checked;
    form.classList.toggle('mediq-wallet-login', !presenter);
    form.querySelector('#capstone-login-error').textContent = '';
    form.querySelector('#capstone-login-help').textContent = presenter
      ? '발표자에게 받은 시연 접근 키로 로그인합니다.'
      : '환자 시연 계정으로 로그인합니다.';
    form.querySelector('#mediq-account-fields').hidden = presenter;
    form.querySelector('#mediq-presenter-fields').hidden = !presenter;
    username.disabled = password.disabled = presenter;
    username.required = password.required = !presenter;
    key.disabled = !presenter; key.required = presenter;
    password.value = key.value = '';
    setRole(presenter ? entryRole : 'PATIENT');
  }
  presenterMode.addEventListener('change', applyMode);
  function setRole(role) {
    entryRole = role;
    for (const button of form.querySelectorAll('[data-entry-role]')) {
      button.classList.toggle('is-active', button.dataset.entryRole === role);
      button.setAttribute('aria-pressed', String(button.dataset.entryRole === role));
    }
    form.querySelector('#capstone-entry-description').textContent = role === 'DOCTOR'
      ? 'B대학병원에서 환자의 동의를 확인하고 전달된 CT를 열람합니다.' : select.value === 'HCC_SYNTHETIC' ? '홍길동님의 CT를 확인하고 B대학병원에 공유합니다.' : '선택한 합성 환자의 영상과 동의를 확인합니다.';
    submit.textContent = role === 'DOCTOR' ? 'B대학병원 의료진으로 시작' : select.value === 'HCC_SYNTHETIC' ? '홍길동으로 시작' : '선택한 합성 환자로 시작';
    if (!presenterMode.checked) submit.textContent = '로그인';
  }
  if (mobile) form.querySelector('.mediq-login-roles').hidden = true;
  for (const button of form.querySelectorAll('[data-entry-role]')) button.addEventListener('click', () => setRole(button.dataset.entryRole));
  setRole(entryRole);
  applyMode();
  const landing = mountDemoEntry(form, role => {
    entryRole = role;
    securityLoginIntent = role === 'SECURITY_ADMIN';
    applySecurityLoginMode(securityLoginIntent);
    if (authPending) return;
    if (entraMode) {
      if (!securityLoginIntent) {
        form.querySelector('#mediq-login-title').textContent = role === 'DOCTOR' ? '의료진 계정으로 로그인해요.' : '내 의료지갑을 열어볼까요?';
        walletLabel.textContent = role === 'DOCTOR' ? '의료진 로그인' : '환자 로그인';
        loginIntro.textContent = role === 'DOCTOR' ? '환자 동의와 전달된 영상에 안전하게 접근합니다.' : '로그인하고 내 영상과 공유 요청을 확인하세요.';
        form.querySelector('#capstone-login-help').textContent = '계정 역할은 사용자의 선택이 아니라 서버의 사용자 매핑으로 결정됩니다.';
        submit.textContent = 'Microsoft 계정으로 로그인';
      }
      submit.focus();
      return;
    }
    presenterMode.checked = role === 'DOCTOR';
    applyMode();
    form.querySelector('#mediq-login-title').textContent = role === 'DOCTOR' ? 'B대학병원 의료진 로그인' : '다음 진료를 준비해요.';
    (presenterMode.checked ? key : username).focus();
  }, {
    pending: true,
    onBack: () => {
      if (!securityLoginIntent) return;
      securityLoginIntent = false;
      entryRole = 'PATIENT';
      applySecurityLoginMode(false);
      if (loginIntentFromSearch(location.search)) history.replaceState(null, '', loginHomePath(location.pathname));
    },
  });
  form.querySelectorAll('.mediq-social button').forEach((button, index) => {
    button.textContent = ['Google', '네이버', '카카오'][index];
    button.setAttribute('aria-label', `${button.textContent} 로그인 · 연동 준비 중`);
  });
  const authConfigError = document.createElement('p');
  authConfigError.setAttribute('role', 'alert');
  authConfigError.className = 'mediq-login-help';
  authConfigError.hidden = true;
  form.querySelector('.mediq-entry-copy').append(authConfigError);
  function showConfigFailure(message) {
    if (securityLoginIntent) {
      entryRole = 'SECURITY_ADMIN';
      applySecurityLoginMode(true);
    }
    landing.open(entryRole);
    authConfigError.hidden = false;
    authConfigError.textContent = message;
    form.querySelector('#capstone-login-error').textContent = message;
    submit.textContent = '로그인 연결 불가';
    submit.disabled = true;
  }
  const legacyControls = [...form.querySelectorAll('#mediq-account-fields, .mediq-presenter-toggle, #mediq-presenter-fields, #mediq-signup-open, .mediq-social, .mediq-login-advanced')];
  const legacyVisibility = legacyControls.map(node => [node, node.hidden]);
  legacyControls.forEach(node => { node.hidden = true; });
  submit.textContent = '로그인 준비 중…';
  form.querySelector('#capstone-login-help').textContent = '안전한 로그인 연결을 준비하고 있어요.';
  form.addEventListener('submit', event => { if (authPending) event.preventDefault(); });
  let entraConfigResponse;
  try {
    entraConfigResponse = await fetch('/api/capstone-demo/auth-config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  } catch {
    showConfigFailure('인증 설정을 확인하지 못했습니다. 연결을 확인하고 새로고침해 주세요.');
    return await new Promise(() => {});
  }
  if (entraConfigResponse.status !== 404 || requiresEntra(location.hostname)) {
    let entraConfig;
    try {
      if (!entraConfigResponse.ok) throw new Error('ENTRA_CONFIG_UNAVAILABLE');
      entraConfig = validateEntraBrowserConfig(await entraConfigResponse.json(), location.origin);
    } catch {
      showConfigFailure('안전한 로그인 설정을 확인하지 못했습니다. 발표자에게 배포 설정을 확인해 달라고 요청해 주세요.');
      return await new Promise(() => {});
    }

    form.querySelector('#mediq-account-fields').hidden = true;
    username.disabled = password.disabled = true;
    username.required = password.required = false;
    key.disabled = true; key.required = false;
    form.classList.add('mediq-wallet-login');
    form.querySelector('.mediq-login-advanced')?.setAttribute('hidden','');
    presenterMode.disabled = true;
    presenterMode.closest('label').hidden = true;
    form.querySelector('#mediq-presenter-fields').hidden = true;
    form.querySelector('#mediq-signup-open').hidden = true;
    form.querySelector('.mediq-social').hidden = true;
    form.querySelector('.mediq-entry-caption').textContent = '허용된 합성 시연 계정만 접근할 수 있습니다. 역할은 서버의 합성 사용자 매핑으로 결정됩니다.';
    entraMode = true;
    if (securityLoginIntent) {
      entryRole = 'SECURITY_ADMIN';
      applySecurityLoginMode(true);
    }
    landing.showSecurityEntry(!mobile);
    authPending = false;
    const entraError = form.querySelector('#capstone-login-error');
    submit.textContent = '로그인 준비 중…';
    submit.disabled = true;
    const finishEntra = session => {
      const authenticatedSession = Object.freeze({ ...session, provider: 'ENTRA_OIDC' });
      const reveal = () => {
        renderPatientAccount(authenticatedSession, mobile);
        document.documentElement.dataset.authReady = '1';
        for (const [node, wasInert] of inactive) if (node.isConnected) node.inert = wasInert;
        document.documentElement.style.overflow = previousOverflow;
        form.remove();
      };
      // Mobile prepares its authenticated home behind the same wallet screen.
      // Do not expose the obsolete development-auth overlay between these steps.
      if (!mobile) reveal();
      return Object.freeze({ ...authenticatedSession,
        reveal,
        initializationFailed() {
          const waiting = form.querySelector('.mediq-auth-waiting');
          waiting.querySelector('h1').textContent = '의료지갑을 열지 못했어요.';
          waiting.querySelector('p').textContent = '연결을 확인하고 다시 로그인해 주세요.';
          const retry = document.createElement('button');
          retry.type = 'button'; retry.className = 'mediq-login-submit';
          retry.textContent = '로그인 다시 시도';
          retry.addEventListener('click', () => location.reload());
          waiting.append(retry);
        },
      });
    };
    let redirectLogin;
    let redirectFailed = false;
    try {
      const msalModule = await import('/vendor/msal-browser.js');
      redirectLogin = await createEntraRedirectLogin({config:entraConfig,msalModule,appOrigin:location.origin});
      const resumed = await redirectLogin.resume();
      if (resumed) {
        if (securityLoginIntent && !isSecurityAdminSession(resumed)) {
          redirectFailed = true;
          landing.open('SECURITY_ADMIN');
          entraError.textContent = '이 계정에는 보안 운영자 권한이 확인되지 않았습니다. 권한이 부여된 계정으로 다시 시도해 주세요.';
        } else return finishEntra(resumed);
      }
    } catch (error) {
      redirectFailed = true;
      landing.open(securityLoginIntent ? 'SECURITY_ADMIN' : entryRole);
      entraError.textContent = securityLoginIntent && error?.message === 'ENTRA_IDENTITY_DENIED'
        ? '이 계정에는 보안 운영자 권한이 확인되지 않았습니다. 권한이 부여된 계정으로 다시 시도해 주세요.'
        : '로그인 연결을 확인하지 못했거나 로그인이 취소되었습니다. 다시 시도해 주세요.';
    }
    submit.textContent = redirectLogin ? (securityLoginIntent ? 'Microsoft 계정으로 계속' : 'Microsoft 계정으로 로그인') : '로그인 다시 준비하기';
    submit.disabled = false;
    if (!redirectFailed) {
      if (securityLoginIntent) landing.open('SECURITY_ADMIN');
      else landing.show();
    }
    if (!securityLoginIntent) form.querySelector('#capstone-login-help').textContent = 'Microsoft 로그인 화면으로 이동합니다. 비밀번호는 이 화면에 입력하지 않습니다.';
    const entraSession = await new Promise(resolve => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        entraError.textContent = '';
        submit.disabled = true;
        try {
          submit.textContent = 'Microsoft 로그인으로 이동 중…';
          if (!redirectLogin) {
            const retryUrl = new URL(loginHomePath(location.pathname), location.origin);
            if (securityLoginIntent) retryUrl.searchParams.set('loginIntent', 'security');
            location.replace(retryUrl.href);
            return;
          }
          await redirectLogin.start(securityLoginIntent ? 'SECURITY_ADMIN' : null);
        } catch (error) {
          entraError.textContent = error?.code === 'CAPSTONE_SESSION_EXPIRED'
            ? '인증이 만료되었습니다. 다시 로그인해 주세요.'
            : '로그인할 수 없습니다. 허용된 합성 시연 계정과 연결 상태를 확인해 주세요.';
        } finally {
          if (form.isConnected) {
            submit.disabled = false;
            submit.textContent = securityLoginIntent ? 'Microsoft 계정으로 계속' : 'Microsoft 계정으로 로그인';
          }
        }
      });
    });
    return entraSession;
  }
  authPending = false;
  for (const [node, hidden] of legacyVisibility) node.hidden = hidden;
  applyMode();
  try {
    const response = await fetch('/api/capstone-demo/scenario', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const config = requireCapstoneScenario(response.status, response.ok ? await response.json() : null);
    if (!config.mainScenario) {
      select.replaceChildren(new Option('기존 합성 환자', 'DEFAULT'), new Option('CT·MR 팬텀 환자', 'PHANTOM'), new Option('홍길동 · 56세 · 복부 CT', 'HCC_SYNTHETIC'));
      select.value = 'HCC_SYNTHETIC';
      form.querySelector('#capstone-legacy-profiles').hidden = false;
      setRole(entryRole);
    }
    select.addEventListener('change', () => setRole(entryRole));
    submit.disabled = false;
    landing.show();
    if (!landing.isOpen()) (presenterMode.checked ? key : username).focus();
  } catch (error) {
    landing.open(entryRole);
    submit.disabled = true;
    form.querySelector('#capstone-login-error').textContent = error.message === 'LOGIN_PREFLIGHT_DENIED'
      ? '로그인 사전확인이 거부되었습니다. 발표자에게 서버 버전과 인증 연결 설정을 확인해 달라고 요청해 주세요.'
      : error.message === 'LOGIN_RUNTIME_NOT_READY'
        ? '이 서버에는 시연 로그인이 준비되지 않았습니다. 발표자에게 인증 서버 설정을 확인해 달라고 요청해 주세요.'
        : '시연 서버에 연결하지 못했습니다. 연결을 확인하고 새로고침해 주세요.';
  }
  const profiles = await new Promise(resolve => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const input = presenterMode.checked ? key : password;
      const button = submit;
      button.disabled = true;
      try {
        const patientProfile = presenterMode.checked ? select.value : 'HCC_SYNTHETIC';
        const credentials = presenterMode.checked ? { key: input.value, patientProfile, entryRole } : { username: username.value, password: input.value, patientProfile, entryRole: 'PATIENT' };
        const response = await fetch("/api/capstone-demo/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(credentials), signal: AbortSignal.timeout(10000), cache: "no-store" });
        input.value = "";
        if (!response.ok) { const failure = await response.json().catch(() => ({})); throw new Error(failure.error || 'DEMO_LOGIN_FAILED'); }
        const session = await response.json();
        if (!session.profiles || !Number.isFinite(Date.parse(session.expiresAt))) throw new Error("INVALID_DEMO_SESSION");
        const expectedPatient = patientProfile === 'PHANTOM' ? 'HP-TEST-PHANTOM-001'
          : patientProfile === 'HCC_SYNTHETIC' ? 'MEDIQ-SYN-HCC-001' : 'P-1001';
        if (session.demoContext?.patientId !== expectedPatient && !(patientProfile === 'DEFAULT' && !session.demoContext)) throw new Error('DEMO_PATIENT_CONTEXT_MISMATCH');
        for (const [node, wasInert] of inactive) if (node.isConnected) node.inert = wasInert;
        document.documentElement.style.overflow = previousOverflow;
        document.documentElement.dataset.authReady = '1';
        form.remove();
        const badge = document.createElement("div");
        badge.textContent = "CAPSTONE · 합성 데이터 · Mock IdP · 비운영 환경";
        badge.style.cssText = "position:relative;background:#eff6ff;color:#1e40af;padding:8px 16px;font-size:12px;line-height:1.5;text-align:center";
        document.body.prepend(badge);
        resolve(session);
      } catch (error) {
        form.querySelector("#capstone-login-error").textContent = error.message === 'HCC_CATALOG_NOT_REGISTERED'
          ? '홍길동님의 CT 등록을 준비 중입니다. 발표자에게 환경 준비 상태를 확인해 주세요.'
          : error.message === 'DEMO_PROFILE_ARCHIVED' ? '이전 시연 환자는 보관 처리되었습니다. 홍길동 시나리오를 선택하세요.'
          : '아이디·비밀번호 또는 시연 접근 키와 연결을 확인해 주세요.';
      } finally { input.value = ""; button.disabled = false; }
    });
  });
  const authenticatedSession = { roles: Object.keys(profiles.profiles), context: profiles.demoContext ?? { patientId: 'P-1001', patientName: '가상환자 1001', defaultStudyUid: '1.2.410.100.1.20260620.001' }, headers(role) {
    if (Date.now() >= Date.parse(profiles.expiresAt)) {
      const error = new Error("시연 인증이 만료되었습니다. 새로고침하여 다시 로그인해 주세요.");
      error.code = "CAPSTONE_SESSION_EXPIRED";
      throw error;
    }
    if (!profiles.profiles[role]) throw new Error("이 역할은 현재 캡스톤 시연 범위에 없습니다.");
    return { authorization: `Bearer ${profiles.profiles[role]}` };
  } };
  renderPatientAccount(authenticatedSession, mobile);
  return authenticatedSession;
}
