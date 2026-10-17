"""Run file-install primitives on private disposable Linux fixtures, never live paths."""
import hashlib
import importlib.util
import json
import os
import pathlib
import shlex
import uuid
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parent.parent
SOURCES=['scripts/lib/hcc_source_file_assets.py','test/hcc_source_file_assets_test.py']


def remote_program(sources):
    if set(sources)!=set(SOURCES):raise ValueError('EXACT_DISPOSABLE_TEST_SOURCES_REQUIRED')
    return 'SOURCES='+repr(sources)+'\n'+r'''
import pathlib,tempfile,os,socket,importlib.util,unittest,io,json,subprocess
assert os.geteuid()==0 and socket.gethostname()=='highpass-cloud'
def runtime_identity():
 value=subprocess.run(['docker','inspect','hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1'],
  capture_output=True,check=True,timeout=10)
 items=json.loads(value.stdout);assert all(item['State']['Running'] for item in items)
 return [{key:item[key] for key in ['Id','Image','Config','Mounts','HostConfig']}|{'startedAt':item['State']['StartedAt']} for item in items]
before=runtime_identity()
result={'status':'NOT VERIFIED','scope':'DISPOSABLE_LINUX_FILESYSTEM_NOT_LIVE_INSTALL_OR_A_HOST_TRUST'}
with tempfile.TemporaryDirectory(prefix='hp-hcc-file-check-') as name:
 root=pathlib.Path(name).resolve()
 assert root.parent==pathlib.Path('/tmp') and root.name.startswith('hp-hcc-file-check-')
 for relative,source in SOURCES.items():
  target=root/relative;target.parent.mkdir(parents=True,exist_ok=True)
  with target.open('x',encoding='utf8') as stream:stream.write(source)
 spec=importlib.util.spec_from_file_location('isolated_file_suite',root/'test/hcc_source_file_assets_test.py')
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 suite=unittest.defaultTestLoader.loadTestsFromModule(module)
 output=io.StringIO();observed=unittest.TextTestRunner(stream=output,verbosity=0).run(suite)
 linux_tests=unittest.defaultTestLoader.loadTestsFromTestCase(module.LinuxSourceFilePrimitive).countTestCases()
 result.update({'testsRun':observed.testsRun,'linuxFilesystemTests':linux_tests,'skipped':len(observed.skipped),
  'failures':len(observed.failures),'errors':len(observed.errors),'status':'PASS' if observed.wasSuccessful() and not observed.skipped and linux_tests==5 else 'FAIL'})
result['cleanup']='OWNED_TEMPORARY_DIRECTORIES_REMOVED'
result['protectedCloudRuntimeUnchanged']=runtime_identity()==before
if not result['protectedCloudRuntimeUnchanged']:result['status']='FAIL'
print(json.dumps(result));raise SystemExit(0 if result['status']=='PASS' else 2)
'''


def main():
    import paramiko
    sources={name:(ROOT/name).read_text(encoding='utf8') for name in SOURCES}
    directory=ROOT/'artifacts/workstation'/('hcc-source-files-linux-'+uuid.uuid4().hex)
    directory.mkdir(exist_ok=False)
    client=paramiko.SSHClient()
    try:
        identity=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),
                       look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10)
        spec=importlib.util.spec_from_file_location('isolated_file_ops',ROOT/'scripts/workstation-automatic-ops.py')
        ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
        code,output=ops.run(client,'sudo -n timeout 30s python3 -c '+shlex.quote(remote_program(sources)),seconds=35)
        result=json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception:
        result={'status':'NOT VERIFIED','reason':'INSPECT_ISOLATED_TEST_PROCESS_AND_EXACT_TEMP_PATH_BEFORE_RETRY'}
    finally:client.close()
    result.update({'observedAt':datetime.now(timezone.utc).isoformat(),'review':'DRAFT / UNASSIGNED',
                   'sourceHashes':[{'path':name,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in SOURCES],
                   'liveCredentialInstallation':'NOT EXECUTED','deployment':'NOT EXECUTED'})
    target=directory/'result.json';target.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(target),**result}))
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
