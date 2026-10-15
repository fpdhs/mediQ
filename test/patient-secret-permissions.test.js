import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('patient secret policy accepts restricted nonroot reads and rejects unsafe metadata',()=>{
  const bundled='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe';
  const python=process.platform==='win32'&&existsSync(bundled)?bundled:(process.platform==='win32'?'python':'python3');
  const result=spawnSync(python,['-I','test/patient_secret_permissions_test.py'],{
    cwd:process.cwd(),encoding:'utf8',timeout:10000,windowsHide:true,
  });
  assert.equal(result.error,undefined,'Python policy test must execute, not silently skip');
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stderr,/Ran 3 tests/);
});
