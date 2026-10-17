import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Invalid export requests fail before any Docker export or remote operation.
for(const [name,args,reason] of [
  ['implicit legacy candidates',['--export-images'],'EXPLICIT_SOURCE_ROLES_REQUIRED_FOR_EXPORT'],
  ['duplicate export flag',['--export-images','--export-images'],'DUPLICATE_EXPORT_FLAG'],
  ['missing roles',['--export-images','a=highpass-platform-mvp:capstone-hcc-source-a-test'],'THREE_DISTINCT_SOURCE_ROLES_REQUIRED'],
  ['unknown destination',['--export-images','b=highpass-platform-mvp:capstone-hcc-source-b-test'],'EXACT_ROLE_LOCAL_CANDIDATE_REQUIRED'],
]){
  test('candidate archive rejects '+name,()=>{
    const result=spawnSync(process.execPath,['scripts/verify-hcc-scenario-candidates.js',...args],{
      encoding:'utf8',timeout:10000,
    });
    assert.equal(result.error,undefined);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,new RegExp(reason));
  });
}
