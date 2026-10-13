import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/ui/clinician-preparation.css', import.meta.url), 'utf8');
const helpers = app.slice(app.indexOf('function clinicianHospitalLabel('), app.indexOf('function updateHospitalSaaSState('));
const context = vm.createContext({});
vm.runInContext(helpers, context);

test('clinician home translates internal routing values into readable Korean labels', () => {
  assert.equal(vm.runInContext('clinicianHospitalLabel("HOSP-A")', context), 'A대학병원');
  assert.equal(vm.runInContext('clinicianHospitalLabel("HOSP-B")', context), 'B대학병원');
  assert.equal(vm.runInContext('clinicianHospitalLabel("HOSP-Z")', context), '병원 확인 필요');
  assert.equal(vm.runInContext('clinicianPurposeLabel("TREATMENT")', context), '진료');
  assert.equal(vm.runInContext('clinicianPermissionLabel("VIEW_ONLY")', context), '영상 열람만');
  assert.equal(vm.runInContext('clinicianPermissionLabel("UNKNOWN_SCOPE")', context), '허용 범위 확인 필요');
});

test('clinician home explains that active consent is not a granted image-access decision', () => {
  assert.match(app, /영상 열람 전 서버가 권한을 다시 확인합니다/);
  assert.match(app, /열람 전 서버 재검증/);
  assert.match(html, /<th>보낸 병원<\/th><th>받는 병원<\/th><th>공유 목적<\/th><th>허용 범위<\/th><th>동의 상태<\/th>/);
  assert.match(html, /공유·접근 상태 보기/);
});

test('clinician home layout keeps navigation operable at tablet widths and honors reduced motion', () => {
  assert.match(css, /max-width: 1160px\) and \(min-width: 761px\)[\s\S]*?\.mq-sidebar \{[\s\S]*?overflow-x: auto/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?clinical-home-flow-step \{\s*transition: none/);
  assert.match(css, /max-width: 760px\)[\s\S]*?\.mq-table-wrap tbody tr \{\s*display: grid/);
  for (const label of ['환자 번호', '보낸 병원', '받는 병원', '공유 목적', '허용 범위', '동의 상태', '다음 행동']) {
    assert.ok(app.includes(`data-label="${label}"`), `responsive exchange card exposes ${label}`);
  }
  assert.match(css, /\.clinical-home-flow-step:focus-visible|#clinical-home :is\(button, a\):focus-visible/);
});
