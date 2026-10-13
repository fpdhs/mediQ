const app = document.querySelector('#hospital-saas-app');
const dialog = document.querySelector('#clinician-tools');
const trigger = document.querySelector('#open-clinician-tools');
if (app && dialog && trigger) {
  const metrics = app.querySelector('.clinical-home-status');
  if (metrics) document.querySelector('#demo-tools-status').append(metrics);
  const checklist = app.querySelector('.clinical-home-first-step');
  if (checklist) document.querySelector('#demo-tools-checklist').append(checklist);
  const close = () => dialog.close();
  const table = document.querySelector('#saas-recent-exchange-rows');
  const syncContext = () => {
    const patient = table?.querySelector('[data-label="환자 번호"]');
    document.querySelector('#demo-tools-patient').textContent = patient ? `환자 번호 ${patient.textContent.trim()}` : '선택한 공유 없음';
    document.querySelector('#demo-tools-consent').textContent = table?.querySelector('[data-label="동의 상태"]')?.textContent.trim() || '공유 정보를 확인해 주세요';
  };
  if (table) new MutationObserver(syncContext).observe(table, { childList:true, subtree:true, characterData:true });
  syncContext();
  const toolNames = { 'pacs-archive':'전송 확인', exchange:'영상 보안 여정', audit:'보안 타임라인', admin:'운영 관제' };
  const syncScreen = () => {
    const screen = app.querySelector('.mq-screen:not([hidden])')?.dataset.screen;
    document.querySelector('#demo-tool-return').hidden = !toolNames[screen];
    document.querySelector('#demo-tool-name').textContent = toolNames[screen] || '';
  };
  app.querySelectorAll('.mq-screen').forEach(screen => new MutationObserver(syncScreen).observe(screen, {attributes:true, attributeFilter:['hidden']}));
  syncScreen();
  trigger.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.demo-tools-close').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }
    if (event.target.closest('[data-view-jump], [data-persona]')) close();
  });
  document.querySelector('#demo-tools-refresh').addEventListener('click', () => document.querySelector('#refresh')?.click());
  // Close on a persona change so a modal never remains above a hidden app.
  new MutationObserver(() => { if (app.hidden && dialog.open) close(); }).observe(app, { attributes: true, attributeFilter: ['hidden'] });
}
