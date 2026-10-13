import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {journeyState} from '../public/ui/image-journey.js';
test('eight security gates bound both destination modes',()=>{
  assert.equal(journeyState('view',0).steps[0][0],'본인 확인');
  assert.equal(journeyState('store',0).steps.length,8);
  assert.equal(journeyState('store',999).index,7);
  assert.equal(journeyState('view',7).canNext,false);
  assert.equal(journeyState('bad',-4).index,0);
});
test('every gate provides conditions, example, location and verification limit',()=>{
  for(let i=0;i<8;i++)for(const key of ['check','block','where','tech','example','limit'])assert.ok(journeyState('view',i).gate[key]);
});
test('denial and unavailable stop progression with distinct language',()=>{
  assert.equal(journeyState('view',2,'denied').canNext,false);
  assert.match(journeyState('view',2,'denied').title,/권한/);
  assert.equal(journeyState('view',2,'unavailable').canNext,false);
  assert.match(journeyState('view',2,'unavailable').title,/거부가 아니/);
});
test('presentation module has no network calls or persistent evidence writes',()=>{
  const source=readFileSync(new URL('../public/ui/image-journey.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|setInterval|setTimeout/);
  assert.match(source,/textContent/);
});
