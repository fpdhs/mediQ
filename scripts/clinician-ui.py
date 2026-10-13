"""Single-source clinician UI management. Build once, verify source/image/served bytes.

Authentication, API services and patient HTML remain owned by the captured host.
No command treats static parity as evidence of authorized DICOM/PACS success.
"""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import re
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('clinician_bundle', ROOT/'scripts/clinician-bundle-stage.py')
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)
REQUIRED_CHECKS = ['clinician_login', 'clinician_menu_apis', 'policy_denials', 'patient_login', 'patient_sharing']

def sha(data):
    return hashlib.sha256(data).hexdigest()

def run(args, timeout=60):
    return subprocess.check_output(args, cwd=ROOT, timeout=timeout)

def load_bundle(folder, current_source=True):
    folder = (ROOT/folder).resolve()
    assert folder.is_relative_to((ROOT/'artifacts/workstation').resolve()), 'BUNDLE_LOCATION_INVALID'
    manifest = json.loads((folder/'manifest.json').read_text(encoding='utf8'))
    assert manifest.get('schema') == bundle.SCHEMA, 'LEGACY_PARTIAL_BUNDLE_RESTAGE_REQUIRED'
    context = folder/'build-context'
    actual_files = {p.relative_to(context).as_posix() for p in (context/'public').rglob('*') if p.is_file()}
    assert actual_files == set(manifest['hashes']), 'UNDECLARED_OR_MISSING_PUBLIC_ASSET'
    for name, digest in manifest['hashes'].items():
        path = (context/name).resolve()
        assert path.is_relative_to(context.resolve()), 'BUNDLE_PATH_INVALID'
        assert path.is_file() and sha(path.read_bytes()) == digest, 'BUNDLE_BYTES_CHANGED_'+name
    version = (context/'public/clinician-ui-version.js').read_text(encoding='utf8')
    assert version.startswith('export default ') and version.rstrip().endswith(';'), 'VERSION_INVALID'
    identity = json.loads(version[len('export default '):].strip()[:-1])
    assert identity['revision'] == manifest['sourceRevision'], 'SOURCE_REVISION_MISMATCH'
    unsigned = {k:v for k,v in identity.items() if k != 'revision'}
    assert sha(json.dumps(unsigned,sort_keys=True,separators=(',',':')).encode()) == identity['revision'], 'IDENTITY_INVALID'
    assert set(manifest['hashes']) == set(identity['sourceHashes']) | {'public/index.html','public/clinician-ui-version.js'}, 'INCOMPLETE_BUNDLE'
    assert all(manifest['hashes'][name] == digest for name,digest in identity['sourceHashes'].items()), 'SOURCE_HASH_MISMATCH'
    html = (context/'public/index.html').read_bytes().decode('utf8')
    a,b = bundle.region(html,'hospital-saas-app')
    assert sha(html[a:b].encode()) == identity['workspaceSha256'], 'WORKSPACE_CHANGED'
    original = (folder/'baseline-index.html').read_bytes().decode('utf8')
    x,y = bundle.region(original,'patient-portal-app')
    a,b = bundle.region(html,'patient-portal-app')
    assert original[x:y] == html[a:b], 'PATIENT_HTML_CHANGED'
    assert sha(original[x:y].encode()) == manifest['patientHtmlSha256'], 'PATIENT_BASELINE_CHANGED'
    if current_source:
        assert identity == bundle.source_identity(), 'SOURCE_CHANGED_RESTAGE_REQUIRED'
    return folder, manifest, identity

def check_served(folder, url, ca=None):
    folder, manifest, identity = load_bundle(folder)
    parsed = urllib.parse.urlsplit(url)
    assert parsed.hostname and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment, 'URL_INVALID'
    assert parsed.scheme == 'https' or (parsed.scheme == 'http' and parsed.hostname in ['localhost','127.0.0.1','::1']), 'HTTPS_REQUIRED'
    context = ssl.create_default_context(cafile=ca)
    origin = urllib.parse.urlunsplit((parsed.scheme,parsed.netloc,'','',''))
    def fetch(path):
        request = urllib.request.Request(origin+path,headers={'Cache-Control':'no-cache'})
        # Do not follow redirects to another origin or accidentally attest a login page.
        with urllib.request.urlopen(request,context=context,timeout=10) as response:
            assert response.geturl() == origin+path, 'UNEXPECTED_REDIRECT'
            data = response.read(2097153)
            assert len(data) <= 2097152, 'STATIC_FILE_TOO_LARGE'
            return data
    html = fetch(parsed.path or '/').decode('utf8')
    a,b = bundle.region(html,'hospital-saas-app')
    assert sha(html[a:b].encode()) == identity['workspaceSha256'], 'SERVED_WORKSPACE_DIFFERS'
    sheets,scripts = bundle.entry_assets(html)
    assert sheets[:len(identity['stylesheets'])] == identity['stylesheets'], 'SERVED_STYLE_ORDER_DIFFERS'
    assert all(s in scripts for s in identity['scripts']), 'SERVED_ENTRY_MISSING'
    for name,digest in manifest['hashes'].items():
        if name == 'public/index.html':continue  # Host injects data-capstone outside clinician root.
        if name == 'public/clinician-ui-version.js' and parsed.hostname in ['localhost','127.0.0.1','::1']:continue
        assert sha(fetch('/'+name.removeprefix('public/'))) == digest, 'SERVED_FILE_DIFFERS_'+name
    return dict(status='PASS',scope='STATIC_UI_PARITY_ONLY',sourceRevision=identity['revision'],files=len(manifest['hashes']),url=url)

def validate_scan(path, image):
    scan = json.loads((ROOT/path).read_text(encoding='utf8'))
    assert scan['Metadata']['ImageID'] == image and isinstance(scan.get('Results'),list), 'SCAN_IMAGE_MISMATCH'
    age = (datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z','+00:00'))).total_seconds()
    assert 0 <= age < 86400, 'SCAN_EXPIRED'
    assert not any(v['Severity'] in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities',[])), 'SCAN_FAILED'

def validate_flow_report(path, folder, image, revision):
    report = json.loads((ROOT/path).read_text(encoding='utf8'))
    assert report.get('image') == image and report.get('sourceRevision') == revision, 'FLOW_REPORT_VERSION_MISMATCH'
    assert all(report.get('checks',{}).get(k) == 'PASS' for k in REQUIRED_CHECKS), 'AUTHENTICATED_REGRESSION_REQUIRED'
    assert report.get('evidence'), 'FLOW_EVIDENCE_REQUIRED'
    for item in report['evidence']:
        evidence = (ROOT/item['path']).resolve()
        assert evidence.is_relative_to((ROOT/'artifacts').resolve()), 'EVIDENCE_LOCATION_INVALID'
        assert evidence.is_file() and sha(evidence.read_bytes()) == item['sha256'], 'FLOW_EVIDENCE_CHANGED'

def rollback_program(baseline, image):
    """Restore the exact captured Compose file list after a failed served-byte check."""
    return 'EXPECTED='+repr(baseline)+'\nCANDIDATE='+repr(image)+'\n'+r'''
import subprocess,json,os,time
def run(args,**kwargs):
 return subprocess.check_output(args,timeout=60,stderr=subprocess.PIPE,**kwargs)
old=EXPECTED[0];name=old['name'].lstrip('/')
current=json.loads(run(['docker','inspect',name]))[0]
assert current['Image']==CANDIDATE
runtime=dict(v.split('=',1) for v in current['Config']['Env'])
labels=old['labels'];stage=labels['com.docker.compose.project.working_dir'];project=labels['com.docker.compose.project']
assert project=='hp-capstone-b-portal'
files=labels['com.docker.compose.project.config_files'].split(',')
env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':old['image'],'HIPASS_B_PORTAL_SECRET_DIR':'/opt/highpass/capstone-b-portal-secrets','HIPASS_KEY_RELEASE_VAULT_KEY_ID':runtime['CAPSTONE_VAULT_KEY_ID']}
args=['docker','compose','--project-directory',stage,'-p',project]
for file in files:args+=['-f',file]
cfg=json.loads(run(args+['config','--format','json'],env=env))
assert cfg['services']['portal']['image']==old['image']
run(args+['up','-d','--no-deps','--pull','never','--force-recreate','portal'],env=env)
end=time.monotonic()+55
while True:
 restored=json.loads(run(['docker','inspect',name]))[0]
 assert restored['Image']==old['image']
 assert dict(v.split('=',1) for v in restored['Config']['Env'])==dict(v.split('=',1) for v in current['Config']['Env']) and restored['Mounts']==current['Mounts']
 assert restored['Config']['Labels']['com.docker.compose.project.config_files'].split(',')==files
 if restored['State'].get('Health',{}).get('Status')=='healthy':break
 assert time.monotonic()<end,'ROLLBACK_READINESS_TIMEOUT'
 time.sleep(1)
print(json.dumps({'status':'PASS','image':old['image'],'rollbackFiles':files}))
'''

def release(args):
    folder, manifest, identity = load_bundle(args.folder)
    image = run(['docker','image','inspect',args.image,'--format','{{.Id}}']).decode().strip()
    assert re.fullmatch('sha256:[a-f0-9]{64}',image), 'IMAGE_ID_INVALID'
    run([sys.executable,str(ROOT/'scripts/clinician-bundle-verify.py'),'--folder',str(folder),'--image',image],300)
    validate_scan(args.scan,image)
    if args.apply:
        if args.live_check:
            assert args.playwright and pathlib.Path(args.playwright).is_file(), 'PLAYWRIGHT_MODULE_REQUIRED'
        else:
            assert args.validation, 'AUTHENTICATED_REGRESSION_REPORT_REQUIRED'
            validate_flow_report(args.validation,folder,image,identity['revision'])
    if not args.credential_gui and not sys.stdin.isatty():
        raise RuntimeError('B_VM_CREDENTIAL_REQUIRED_USE_OPERATOR_TERMINAL_OR_CREDENTIAL_GUI')
    password = bundle.align.check.read_vm_credential(args.credential_gui)
    client = bundle.align.check.connect('B',password)
    try:
        baseline = json.loads((folder/'baseline.json').read_text(encoding='utf8'))
        current = bundle.align.check.inventory(client,'B',password)
        assert current[0]['id'] == baseline[0]['id'] and current[0]['image'] == manifest['base'], 'BASELINE_CHANGED_RESTAGE_REQUIRED'
        ca = (ROOT/'tmp/certs/mtls/ca.crt').read_text()
        result = bundle.align.check.remote(client,'B',password,bundle.align.remote_program('B',baseline,image,ca,False),90)
        assert result['status'] == 'PASS', 'DEPLOYMENT_PREFLIGHT_FAILED'
        print(json.dumps(dict(phase='PREFLIGHT',status='PASS')),flush=True)
        if args.apply:
            probe='import subprocess,json;r=subprocess.run(["docker","image","inspect",'+repr(image)+',"--format","{{.Id}}"],capture_output=True,timeout=15);print(json.dumps({"present":r.returncode==0 and r.stdout.decode().strip()=='+repr(image)+'}))'
            present=bundle.align.check.remote(client,'B',password,probe,20)['present']
            if not present:
                archive = folder/'candidate.tar'
                run(['docker','save','-o',str(archive),image],180)
                digest = sha(archive.read_bytes())
                target = '/home/server/.clinician-ui-'+image[7:23]+'.tar'
                with client.open_sftp() as sftp:
                    sftp.get_channel().settimeout(20)
                    started = time.monotonic()
                    def deadline(done,total):
                        if time.monotonic()-started > 240:raise TimeoutError('TRANSFER_TIMEOUT')
                    sftp.put(str(archive),target,callback=deadline)
                    sftp.chmod(target,0o600)
                program = 'import pathlib,hashlib,subprocess,json;p=pathlib.Path('+repr(target)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(digest)+';subprocess.run(["docker","load","-i",str(p)],check=True,capture_output=True,timeout=90);print(json.dumps({"status":"PASS"}))'
                bundle.align.check.remote(client,'B',password,program,100)
            print(json.dumps(dict(phase='IMAGE_PRESENT' if present else 'IMAGE_TRANSFER',status='PASS')),flush=True)
            result = bundle.align.check.remote(client,'B',password,bundle.align.remote_program('B',baseline,image,ca,True),260)
        result.update(scope='UNIFIED_CLINICIAN_UI',sourceRevision=identity['revision'],deployed=args.apply,observedAt=datetime.now(timezone.utc).isoformat())
        (folder/'release-result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
        assert result['status'] == 'PASS', 'RELEASE_FAILED_SEE_RECEIPT'
        print(json.dumps(dict(phase='ACTIVATION',status=result['status'],rollback=result['rollback'])),flush=True)
        if args.apply:
            try:
                if args.live_check:
                    browser_env = dict(__import__('os').environ, NODE_EXTRA_CA_CERTS=str(ROOT/'tmp/certs/mtls/ca.crt'))
                    subprocess.check_output(['node',str(ROOT/'scripts/clinician-ui-live-check.js'),'--folder',str(folder),'--image',image,'--revision',identity['revision'],'--playwright',args.playwright],cwd=ROOT,env=browser_env,timeout=180)
                    browser_report=json.loads((folder/'browser-regression.json').read_text())
                    assert browser_report['status']=='PASS', 'AUTHENTICATED_UI_REGRESSION_FAILED'
                    gate=dict(image=image,sourceRevision=identity['revision'],checks=browser_report['checks'],evidence=[dict(path=(folder/'browser-regression.json').relative_to(ROOT).as_posix(),sha256=sha((folder/'browser-regression.json').read_bytes()))])
                    (folder/'validation.json').write_text(json.dumps(gate,indent=2))
                    validate_flow_report(str(folder/'validation.json'),folder,image,identity['revision'])
                parity = check_served(str(folder),'https://192.168.111.149:9443/hipass',str(ROOT/'tmp/certs/mtls/ca.crt'))
            except Exception as error:
                result.update(status='FAIL',reason='POST_DEPLOYMENT_UI_VALIDATION_FAILED',detail=str(error) if isinstance(error,AssertionError) else type(error).__name__,rollback='NOT VERIFIED')
                try:
                    rollback = bundle.align.check.remote(client,'B',password,rollback_program(baseline,image),120)
                    result.update(rollback=rollback['status'],deployed=False)
                finally:
                    (folder/'release-result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
                raise
            (folder/'served-parity.json').write_text(json.dumps(parity,indent=2),encoding='utf8')
        return result
    finally:
        client.close()
        password = None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command',required=True)
    for command in ['check','build','release']:
        p = sub.add_parser(command)
        p.add_argument('--folder',required=True)
        if command == 'check':
            p.add_argument('--url')
            p.add_argument('--ca')
        else:p.add_argument('--image',required=True)
        if command == 'release':
            p.add_argument('--scan',required=True)
            p.add_argument('--validation')
            p.add_argument('--apply',action='store_true')
            p.add_argument('--credential-gui',action='store_true')
            p.add_argument('--live-check',action='store_true',help='Run actual synthetic browser checks after trial activation; restore baseline on failure.')
            p.add_argument('--playwright',help='Installed playwright/index.mjs for --live-check')
    args = parser.parse_args()
    if args.command == 'release':result = release(args)
    else:
        folder,manifest,identity = load_bundle(args.folder)
        result = dict(status='PASS',scope='SOURCE_AND_BUNDLE_PARITY_ONLY',sourceRevision=identity['revision'],files=len(manifest['hashes']),captureMode=manifest['captureMode'])
        if args.command == 'build':
            # Capture the local base ID immediately before building; a mutable tag is not sufficient.
            base = run(['docker','image','inspect',manifest['base'],'--format','{{.Id}}']).decode().strip()
            assert base == manifest['base'], 'BASE_IMAGE_MISMATCH'
            tag='highpass-clinician:base-'+base.removeprefix('sha256:')
            run(['docker','tag',base,tag])
            assert run(['docker','image','inspect',tag,'--format','{{.Id}}']).decode().strip() == base
            subprocess.run(['docker','build','--build-arg','CAPSTONE_BASE_IMAGE='+tag,'-t',args.image,str(folder/'build-context')],cwd=ROOT,check=True,timeout=180)
            assert run(['docker','image','inspect',tag,'--format','{{.Id}}']).decode().strip() == base
            run([sys.executable,str(ROOT/'scripts/clinician-bundle-verify.py'),'--folder',str(folder),'--image',args.image],180)
        elif args.url:
            try:result = check_served(str(folder),args.url,args.ca)
            except (AssertionError,urllib.error.URLError) as error:
                result=dict(status='FAIL',scope='STATIC_UI_PARITY_ONLY',sourceRevision=identity['revision'],reason=str(error))
                (folder/('served-parity-'+('local' if urllib.parse.urlsplit(args.url).hostname in ['localhost','127.0.0.1','::1'] else 'web')+'.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
                print(json.dumps(result));raise SystemExit(2)
        output='source-parity.json'
        if args.command=='check' and args.url:output='served-parity-'+('local' if urllib.parse.urlsplit(args.url).hostname in ['localhost','127.0.0.1','::1'] else 'web')+'.json'
        (folder/output).write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result))

if __name__ == '__main__':
    try:main()
    except (AssertionError,RuntimeError,urllib.error.URLError) as error:
        print(json.dumps(dict(status='FAIL',reason=str(error))))
        raise SystemExit(2)
