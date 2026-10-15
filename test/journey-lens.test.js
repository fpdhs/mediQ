import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GATE_LENSES,gateLensModel} from '../public/ui/journey-lens.js';

test('all eight security illustrations have three bounded accessible explanation points',()=>{
  assert.equal(GATE_LENSES.length,8);
  for(const gate of GATE_LENSES){
    assert.equal(gate.points.length,3);
    for(const [label,x,y,copy] of gate.points){assert.ok(label&&copy.length>30);assert.ok(x>10&&x<90&&y>10&&y<90);}
  }
});
test('a matching explanation never reports actual access granted',()=>{
  for(let i=0;i<8;i++){
    const m=gateLensModel(i);assert.equal(m.result,'다음 검증 단계로');assert.equal(m.tone,'normal');
  }
});
test('denial, transport uncertainty and normal are distinct for every gate',()=>{
  for(let i=0;i<8;i++){
    assert.equal(gateLensModel(i,0,'denied').result,'접근 차단 예시');
    assert.match(gateLensModel(i,0,'unavailable').result,/허용하지 않음/);
    assert.notEqual(gateLensModel(i,0,'denied').reason,gateLensModel(i,0,'unavailable').reason);
  }
});
test('out of bounds input normalizes to an existing annotation',()=>{
  assert.equal(gateLensModel(-1,-1).selected,0);assert.equal(gateLensModel(99,99).selected,2);
  assert.equal(gateLensModel(NaN,NaN).gate,GATE_LENSES[0]);
});
test('lens is presentation-only and has no unsafe HTML or credential handling',()=>{
  const js=readFileSync(new URL('../public/ui/journey-lens.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|innerHTML|setInterval|setTimeout/);
  assert.match(js,/textContent/);assert.match(js,/aria-pressed/);assert.match(js,/설명용 시뮬레이션/);
});
test('glass preserves opaque imaging, reduced motion and native fallback styles',()=>{
  const css=readFileSync(new URL('../public/ui/clinical-glass.css',import.meta.url),'utf8');
  assert.match(css,/@supports \(backdrop-filter/);assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/prefers-reduced-transparency/);assert.match(css,/\.mq-viewport\{[^}]*backdrop-filter:none/);
  assert.doesNotMatch(css,/font-size:[^;}]*vw/);
});
