import test from 'node:test';
import assert from 'node:assert/strict';
import { requireCapstoneScenario } from '../public/capstone-auth.js';

test('login preflight distinguishes denied, unsupported and unavailable runtimes', () => {
  for (const status of [401,403]) assert.throws(() => requireCapstoneScenario(status,null), /LOGIN_PREFLIGHT_DENIED/);
  assert.throws(() => requireCapstoneScenario(404,null), /LOGIN_RUNTIME_NOT_READY/);
  for (const status of [500,503,204]) assert.throws(() => requireCapstoneScenario(status,null), /SCENARIO_UNAVAILABLE/);
});
test('login is not offered for missing or malformed scenario capability', () => {
  for (const config of [null,{}, {mainScenario:true}, {mainScenario:'true',synthetic:true}]) {
    assert.throws(() => requireCapstoneScenario(200,config), /SCENARIO_UNAVAILABLE/);
  }
  for (const mainScenario of [true,false]) {
    const config={mainScenario,synthetic:true};
    assert.equal(requireCapstoneScenario(200,config),config);
  }
});
