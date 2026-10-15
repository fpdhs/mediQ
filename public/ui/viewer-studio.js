// Presentation controls only. Access requests use the existing authorized callback.
export function prepareImagingWorkspace(root=document){
  const desk=root.querySelector('#clinical-desk');
  if(!desk||desk.classList.contains('imaging-focus'))return;
  const canvas=desk.querySelector('.mq-clinical-canvas'),copy=desk.querySelector('.desk-hero-copy'),guide=desk.querySelector('.prep-guide');
  if(!canvas||!copy||!guide)return;
  const doc=root.ownerDocument||root;
  // Move existing, already-bound elements; never clone the protected viewport or its controls.
  guide.prepend(copy);
  for(const section of [...guide.querySelectorAll(':scope > section')]){
    const heading=section.querySelector('h3');if(!heading)continue;
    const details=doc.createElement('details'),summary=doc.createElement('summary');
    summary.textContent=heading.textContent;heading.remove();details.append(summary,...section.childNodes);section.replaceChildren(details);
  }
  const activity=desk.querySelector('.desk-activity');
  if(activity){const details=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent='최근 접근 이력';activity.before(details);details.append(summary,activity);guide.append(details);}
  const title=desk.querySelector('.mq-title h2');if(title)title.textContent='환자 영상';
  desk.classList.add('imaging-focus');
}
export function initializeViewerStudio({ root = document, openViewer, renewAccess, canRenew = () => true }) {
  prepareImagingWorkspace(root);
  const find = selector => root.querySelector(selector);
  const screen = find('#viewer-screen');
  const toggle = find('#studio-info-toggle');
  const inspector = find('#studio-inspector');
  const infoLayout=globalThis.matchMedia?.('(min-width: 1100px)');
  if(screen&&toggle&&inspector&&infoLayout?.matches){
    inspector.hidden=false;toggle.setAttribute('aria-expanded','true');screen.classList.add('studio-inspector-open');
  }
  infoLayout?.addEventListener('change',event=>{
    if(!event.matches&&screen&&toggle&&inspector){inspector.hidden=true;toggle.setAttribute('aria-expanded','false');screen.classList.remove('studio-inspector-open');}
  });
  for (const [id,label] of [['studio-info-toggle','검사 정보'],['tool-pan','영상 이동'],['tool-zoom','영상 확대'],['tool-ww-wl','화면 대비'],['tool-invert','명암 반전'],['tool-reset','영상 조작 초기화']]) {
    find(`#${id}`)?.setAttribute('aria-label',label);
  }
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    inspector.hidden = !open;
    screen.classList.toggle('studio-inspector-open', open);
  });
  screen?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !inspector.hidden) {
      inspector.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      screen.classList.remove('studio-inspector-open');
      toggle.focus();
    }
  });
  const openButton = find('#studio-open-image');
  const renewButton = find('#studio-renew-access');
  const renewLabel = renewButton?.querySelector('span');
  const countdown = find('#viewer-countdown');
  let renewing = false;
  const updateRenewLabel = () => {
    if (renewLabel) renewLabel.textContent = renewing ? '접근 확인 중…' : countdown?.textContent.includes('만료') ? '계속 열람' : '열람 권한 갱신';
  };
  if (countdown) new MutationObserver(updateRenewLabel).observe(countdown,{childList:true,subtree:true,characterData:true});
  renewButton?.addEventListener('click', async () => {
    if (renewing || renewButton.disabled) return;
    renewing = true;
    renewButton.disabled = true;
    renewButton.setAttribute('aria-busy','true');
    updateRenewLabel();
    try { await renewAccess(); }
    catch {
      const status = find('#viewer-alert');
      if (status) { status.textContent='열람 권한을 갱신하지 못했습니다. 로그인 상태와 공유 동의를 확인해 주세요.'; status.dataset.tone='fail'; }
    }
    finally { renewing=false; renewButton.disabled=!canRenew(); renewButton.setAttribute('aria-busy','false'); updateRenewLabel(); }
  });
  openButton?.addEventListener('click', async () => {
    openButton.disabled = true;
    openButton.textContent = '접근 확인 중…';
    find('#viewer-viewport-box')?.setAttribute('aria-busy','true');
    try { await openViewer(); }
    catch {
      const status = find('#viewer-alert');
      if (status) { status.textContent='영상을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.'; status.dataset.tone='fail'; }
    }
    finally { openButton.disabled = false; openButton.textContent = '접근 확인 후 열기'; find('#viewer-viewport-box')?.setAttribute('aria-busy','false'); }
  });
  const message = find('#viewer-alert');
  if (message) new MutationObserver(() => {
    const placeholder = find('#viewer-placeholder');
    if (!placeholder || placeholder.hidden) return;
    const failed = ['fail','warning'].includes(message.dataset.tone);
    placeholder.querySelector('h2').textContent = failed ? '영상 접근을 확인해 주세요' : '의료영상 열람 준비';
    placeholder.querySelector('p').textContent = failed ? message.textContent : '환자가 승인한 검사 범위를 확인하고 의료영상을 불러옵니다.';
  }).observe(message,{childList:true,attributes:true,attributeFilter:['data-tone']});
  const viewport = find('#viewer-viewport-box');
  const image = find('#viewer-image');
  const pan = find('#tool-pan');
  let drag = null, x = 0, y = 0;
  viewport?.addEventListener('pointerdown', event => {
    if (event.button !== 0 || image.hidden || !pan.classList.contains('active')) return;
    event.preventDefault();
    drag = { id:event.pointerId, x:event.clientX-x, y:event.clientY-y };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport?.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId || image.hidden) return;
    x = Math.max(-viewport.clientWidth, Math.min(viewport.clientWidth,event.clientX-drag.x));
    y = Math.max(-viewport.clientHeight, Math.min(viewport.clientHeight,event.clientY-drag.y));
    image.style.translate = `${x}px ${y}px`;
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) viewport?.addEventListener(name, () => { drag = null; });
  const reset = () => { x=0; y=0; drag=null; image.style.translate=''; };
  find('#tool-reset')?.addEventListener('click', reset);
  // New/cleared authorized pixels must not retain the previous image position.
  if (image) new MutationObserver(reset).observe(image,{attributes:true,attributeFilter:['src','hidden']});
}
