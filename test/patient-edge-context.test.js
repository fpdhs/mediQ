import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('edge rollout context pins role/project and rejects escaped, duplicate or arbitrary paths',()=>{
  const bundled='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe';
  const python=process.platform==='win32'&&existsSync(bundled)?bundled:(process.platform==='win32'?'python':'python3');
  const code=`import ast,pathlib,re
p=pathlib.Path('scripts/capstone-patient-edge-rollout.py')
tree=ast.parse(p.read_text())
function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='edge_context')
ns={'pathlib':pathlib,'re':re}
exec(compile(ast.Module(body=[function],type_ignores=[]),str(p),'exec'),ns)
root='/home/server/.highpass-app-2026-10-08T21-31-00.357148+00-00'
for role,project in [('A','hp-capstone-a-gateway'),('B','hp-capstone-b-portal')]:
 labels={'com.docker.compose.project':project,'com.docker.compose.project.working_dir':root,'com.docker.compose.project.config_files':root+'/gateway.yml,'+root+'/encryption.yml'}
 assert ns['edge_context'](labels,role)==(project,root,[root+'/gateway.yml',root+'/encryption.yml'])
 for field,value in [('project','other'),('project.working_dir','/tmp/untrusted'),('project.config_files',root+'/../escape.yml'),('project.config_files','/etc/passwords.yml'),('project.config_files',root+'/gateway.yml,'+root+'/gateway.yml'),('project.config_files',root+'/gateway.yml;echo-bad'),('project.config_files','')]:
  bad={**labels,'com.docker.compose.'+field:value}
  try:ns['edge_context'](bad,role)
  except RuntimeError:pass
  else:raise AssertionError('must deny invalid context')
print('EDGE_CONTEXT_CASES=16 PASS')`;
  const result=spawnSync(python,['-I','-c',code],{cwd:process.cwd(),encoding:'utf8',timeout:10000,windowsHide:true});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/EDGE_CONTEXT_CASES=16 PASS/);
});
