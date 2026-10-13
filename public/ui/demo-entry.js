// The entry screen selects a login view. Authentication stays in capstone-auth.
export function mountDemoEntry(form, openLogin) {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/ui/demo-entry.css'; document.head.append(link);
  const shell = form.querySelector('.mediq-login-shell');
  const entry = document.createElement('section');
  entry.className = 'mediq-entry'; entry.setAttribute('aria-labelledby', 'mediq-entry-title');
  entry.innerHTML = `<div class="mediq-entry-scene" aria-hidden="true"></div>
    <header class="mediq-entry-header"><a class="mediq-entry-brand" href="/hipass/" aria-label="Medi Q 홈"><span class="mediq-login-logo" aria-hidden="true"></span></a><span class="mediq-entry-test">합성 데이터 · 캡스톤 시연</span><button type="button" class="mediq-entry-motion" aria-pressed="false">움직임 멈추기</button></header>
    <div class="mediq-entry-copy"><h1 id="mediq-entry-title">내 영상과 함께,<br><span>다음 진료로.</span></h1><p>A대학병원에서 B대학병원까지,<br>공유는 내가 결정해요.</p><div class="mediq-entry-actions"><button type="button" data-entry-start="PATIENT">환자로 시작하기 <span aria-hidden="true">↗</span></button><button type="button" data-entry-start="DOCTOR">의료진으로 시작하기 <span aria-hidden="true">↗</span></button></div><p class="mediq-entry-caption">홍길동 · 56세의 가상 전원 이야기를 따라갑니다.</p></div>
    <div class="mediq-entry-leaves" aria-hidden="true"><i></i><i></i><i></i></div><footer class="mediq-entry-footer">내가 선택하는 공유, 이어지는 진료.</footer>`;
  form.classList.add('mediq-entry-active');
  if (location.pathname.startsWith('/mobile')) entry.querySelector('[data-entry-start="DOCTOR"]').remove();
  shell.hidden = true; shell.inert = true; form.prepend(entry);
  const back = document.createElement('button'); back.type = 'button';
  back.className = 'mediq-login-back'; back.textContent = '시작 화면으로';
  form.querySelector('.mediq-login-entry').prepend(back);
  let trigger;
  for (const button of entry.querySelectorAll('[data-entry-start]')) button.addEventListener('click', () => {
    trigger = button; entry.hidden = true; shell.hidden = false; shell.inert = false;
    form.classList.remove('mediq-entry-active'); openLogin(button.dataset.entryStart);
  });
  back.addEventListener('click', () => {
    form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
    shell.hidden = true; shell.inert = true; entry.hidden = false;
    form.classList.add('mediq-entry-active'); trigger?.focus();
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
  return { isOpen: () => !entry.hidden };
}
