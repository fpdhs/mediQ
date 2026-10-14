import { loginHomePath } from '../login-navigation.js';
// The entry screen selects a login view. Authentication stays in capstone-auth.
export function mountDemoEntry(form, openLogin, {pending = false, onBack = () => {}} = {}) {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/ui/demo-entry.css'; document.head.append(link);
  const shell = form.querySelector('.mediq-login-shell');
  const entry = document.createElement('section');
  entry.className = 'mediq-entry'; entry.setAttribute('aria-labelledby', 'mediq-entry-title');
  entry.innerHTML = `<div class="mediq-entry-scene" aria-hidden="true"></div>
    <header class="mediq-entry-header"><a class="mediq-entry-brand" href="/hipass/" aria-label="Medi Q 홈"><span class="mediq-login-logo" aria-hidden="true"></span></a><span class="mediq-entry-test">합성 데이터 · 캡스톤 시연</span><button type="button" class="mediq-entry-motion" aria-pressed="false">움직임 멈추기</button></header>
    <div class="mediq-entry-copy"><h1 id="mediq-entry-title">내 영상과 함께,<br><span>다음 진료로.</span></h1><p>A대학병원에서 B대학병원까지,<br>공유는 내가 결정해요.</p><div class="mediq-entry-actions"><button type="button" data-entry-start="PATIENT">환자로 시작하기 <span aria-hidden="true">↗</span></button><button type="button" data-entry-start="DOCTOR">의료진으로 시작하기 <span aria-hidden="true">↗</span></button></div><p class="mediq-entry-caption">홍길동 · 56세의 가상 전원 이야기를 따라갑니다.</p><button type="button" class="mediq-entry-security" data-security-entry hidden><span aria-hidden="true">◈</span> 보안 운영자 전용 로그인</button></div>
    <div class="mediq-entry-leaves" aria-hidden="true"><i></i><i></i><i></i></div><footer class="mediq-entry-footer">내가 선택하는 공유, 이어지는 진료.</footer>`;
  entry.querySelector('.mediq-entry-brand').setAttribute('href', loginHomePath(location.pathname));
  form.classList.add('mediq-entry-active');
  if (location.pathname.startsWith('/mobile')) {
    entry.querySelector('[data-entry-start="DOCTOR"]').remove();
    entry.querySelector('[data-security-entry]').remove();
  }
  shell.hidden = true; shell.inert = true; form.prepend(entry);
  const waiting = document.createElement('section');
  waiting.className = 'mediq-auth-waiting';
  waiting.setAttribute('role', 'status');
  waiting.setAttribute('aria-live', 'polite');
  waiting.innerHTML = '<img src="/images/mediq-login-wallet.webp" alt="" width="240" height="180"><h1>내 의료지갑을 여는 중…</h1><p>안전하게 연결하고 있어요.</p>';
  waiting.hidden = !pending;
  entry.hidden = pending;
  form.classList.toggle('mediq-auth-pending', pending);
  form.prepend(waiting);
  function finishWaiting() {
    waiting.hidden = true;
    form.classList.remove('mediq-auth-pending');
  }
  function showEntry() {
    finishWaiting();
    shell.hidden = true; shell.inert = true; entry.hidden = false;
    form.classList.add('mediq-entry-active');
  }
  const back = document.createElement('button'); back.type = 'button';
  back.className = 'mediq-login-back'; back.textContent = '시작 화면으로';
  form.querySelector('.mediq-login-entry').prepend(back);
  let trigger;
  function open(role, source) {
    finishWaiting();
    trigger = source;
    entry.hidden = true; shell.hidden = false; shell.inert = false;
    form.classList.remove('mediq-entry-active'); openLogin(role);
  }
  for (const button of entry.querySelectorAll('[data-entry-start]')) button.addEventListener('click', () => {
    open(button.dataset.entryStart, button);
  });
  entry.querySelector('[data-security-entry]')?.addEventListener('click', event => open('SECURITY_ADMIN', event.currentTarget));
  back.addEventListener('click', () => {
    form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
    onBack();
    showEntry(); trigger?.focus();
  });
  const motion = entry.querySelector('.mediq-entry-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function pause(value) {
    entry.classList.toggle('mediq-entry-paused', value);
    motion.setAttribute('aria-pressed', String(value));
    motion.textContent = value ? '움직임 켜기' : '움직임 멈추기';
  }
  pause(reduced.matches);
  motion.addEventListener('click', () => pause(!entry.classList.contains('mediq-entry-paused')));
  reduced.addEventListener('change', event => pause(event.matches));
  return {
    isOpen: () => !entry.hidden,
    show: showEntry,
    open: role => open(role, null),
    showSecurityEntry: visible => {
      const button = entry.querySelector('[data-security-entry]');
      if (button) button.hidden = !visible;
    },
  };
}
