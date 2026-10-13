"""Scoped B clinician design release. Pinned SSH, immutable baseline and image-only rollback.
Only the existing clinician dashboard section and its static stylesheet are changed.
No app.js, server, DB, patient UI or mobile PWA changes are included.
"""
import argparse,base64,getpass,hashlib,importlib.util,json,pathlib,re,shutil,subprocess,time
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prep_align',ROOT/'scripts/health-helper-align.py')
align=importlib.util.module_from_spec(spec);spec.loader.exec_module(align)
FILES=['public/index.html','public/ui/clinician-preparation.css']
TOOLS_FILES=FILES+['public/ui/clinician-demo-tools.css','public/ui/clinician-demo-tools.js']

def tools_overlay(original,local):
    """Use the deployed page as baseline; replace clinician-only UI regions."""
    for pattern in [r'<div class="mq-context" aria-label="의료진 컨텍스트">[\s\S]*?(?=\s*</header>\s*<div class="mq-shell-grid">)',
                    r'<aside class="mq-sidebar"[^>]*>[\s\S]*?</aside>',
                    r'<section\b(?=[^>]*\bdata-screen="dashboard")[^>]*>[\s\S]*?(?=\s*<!-- 2\.3 5-Step Exchange Pipeline -->)']:
        source=re.findall(pattern,local);target=re.findall(pattern,original)
        assert len(source)==len(target)==1,'CLINICIAN_OVERLAY_MARKER_MISMATCH'
        original=re.sub(pattern,lambda _:source[0],original,count=1)
    marker='<main class="mq-main" id="clinician-main" tabindex="-1">'
    assert original.count(marker)==1
    returnbar=re.search(r'<div id="demo-tool-return"[^\n]+',local).group(0)
    if 'id="demo-tool-return"' not in original:original=original.replace(marker,marker+'\n'+returnbar,1)
    for sheet in ['clinician-preparation','clinician-demo-tools']:
        tag='<link rel="stylesheet" href="/ui/'+sheet+'.css">'
        if tag not in original:original=original.replace('</head>',tag+'\n</head>',1)
    script='<script type="module" src="/ui/clinician-demo-tools.js"></script>'
    if script not in original:original=original.replace('</body>',script+'\n</body>',1)
    targets=set(re.findall(r'data-view-jump="([^"]+)"',original))
    screens=set(re.findall(r'data-screen="([^"]+)"',original))
    assert targets.issubset(screens),{'missingRoutes':sorted(targets-screens)}
    return original
def run(args,seconds=120):
    return subprocess.run(args,cwd=ROOT,capture_output=True,check=True,timeout=seconds).stdout
def main():
    p=argparse.ArgumentParser();p.add_argument('--stage',action='store_true');p.add_argument('--tools',action='store_true');p.add_argument('--folder');p.add_argument('--image');p.add_argument('--scan');p.add_argument('--apply',action='store_true');a=p.parse_args()
    files=TOOLS_FILES if a.tools else FILES
    password=getpass.getpass('B VM password (concealed, never saved): ')
    c=align.check.connect('B',password)
    try:
        if a.stage:
            baseline=align.check.inventory(c,'B',password)
            assert baseline[0]['health']=='healthy'
            data=align.check.remote(c,'B',password,'import subprocess,base64,json; print(json.dumps({"html":base64.b64encode(subprocess.check_output(["docker","exec",'+repr(baseline[0]['id'])+',"/nodejs/bin/node","-e","process.stdout.write(require(\'fs\').readFileSync(\'/app/public/index.html\'))"],timeout=10)).decode()}))',20)
            folder=ROOT/'artifacts/workstation'/('clinician-preparation-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
            original=base64.b64decode(data['html']).decode();local=(ROOT/'public/index.html').read_text(encoding='utf8')
            # Replace only the dashboard section; app.js, APIs, and screen contracts stay on B.
            pattern=r'<section\b(?=[^>]*\bdata-screen="dashboard")[^>]*>[\s\S]*?(?=\s*<!-- 2\.3 5-Step Exchange Pipeline -->)'
            home_pattern=r'<section class="mq-screen clinician-home" id="clinical-home" data-screen="dashboard">[\s\S]*?(?=\s*<!-- 2\.3 5-Step Exchange Pipeline -->)'
            selected=re.search(home_pattern,local);assert selected and len(re.findall(home_pattern,local))==1 and len(re.findall(pattern,original))==1
            home=selected.group(0)
            available=set(re.findall(r'<section\b[^>]*\bdata-screen="([^"]+)"',original))
            targets=set(re.findall(r'data-view-jump="([^"]+)"',home))
            assert targets and targets.issubset(available),{'missingClinicianRoutes':sorted(targets-available)}
            assert '지갑' not in home
            html=re.sub(pattern,lambda _:home,original,count=1)
            if 'data-screen="records"' not in original:
                html=html.replace('<button class="mq-btn" type="button" data-view-jump="records">환자 기록 확인</button>','<button class="mq-btn" type="button" disabled>환자 기록 연결 준비 중</button>')
            marker='<link rel="stylesheet" href="/ui/clinician-desk.css">';assert marker in html
            if 'href="/ui/clinician-preparation.css"' not in html:
                html=html.replace(marker,marker+'\n  <link rel="stylesheet" href="/ui/clinician-preparation.css">',1)
            if a.tools:html=tools_overlay(original,local)
            (folder/'index.html').write_text(html,encoding='utf8');(folder/'baseline.json').write_text(json.dumps(baseline,indent=2))
            (folder/'baseline-index.html').write_text(original,encoding='utf8')
            context=folder/'build-context';context.mkdir(exist_ok=False)
            shutil.copyfile(folder/'index.html',context/'index.html')
            shutil.copyfile(ROOT/'public/ui/clinician-preparation.css',context/'clinician-preparation.css')
            if a.tools:
                for f in TOOLS_FILES[2:]:shutil.copyfile(ROOT/f,context/pathlib.Path(f).name)
            (context/'Dockerfile').write_text('ARG CAPSTONE_BASE_IMAGE\nFROM ${CAPSTONE_BASE_IMAGE}\nCOPY index.html /app/public/index.html\nCOPY clinician-preparation.css /app/public/ui/clinician-preparation.css\n',encoding='utf8')
            if a.tools:
                with (context/'Dockerfile').open('a',encoding='utf8') as dockerfile:
                    for f in TOOLS_FILES[2:]:dockerfile.write('COPY '+pathlib.Path(f).name+' /app/'+f+'\n')
            hashes={'baselineIndexSha256':hashlib.sha256(original.encode()).hexdigest(),
                    'candidateIndexSha256':hashlib.sha256(html.encode()).hexdigest(),
                    'candidateStylesheetSha256':hashlib.sha256((context/'clinician-preparation.css').read_bytes()).hexdigest()}
            (folder/'manifest.json').write_text(json.dumps({'scope':'CLINICIAN_HOME_STATIC_ONLY','review':'DRAFT / UNASSIGNED','sourceHashes':hashes},indent=2))
            print(json.dumps({'scope':'READ_ONLY_BASELINE_AND_HOME_STAGE','folder':str(folder),'base':baseline[0]['image'],'health':baseline[0]['health'],'routes':sorted(targets),'sourceHashes':hashes}));return
        assert a.folder and a.image and a.scan
        folder=(ROOT/a.folder).resolve();assert folder.is_relative_to((ROOT/'artifacts/workstation').resolve())
        baseline=json.loads((folder/'baseline.json').read_text());current=align.check.inventory(c,'B',password);assert current[0]['id']==baseline[0]['id'] and current[0]['image']==baseline[0]['image'],'BASELINE_CHANGED'
        candidate=run(['docker','image','inspect',a.image,'--format','{{.Id}}']).decode().strip();assert re.fullmatch('sha256:[a-f0-9]{64}',candidate)
        scanpath=(ROOT/a.scan).resolve();assert scanpath.is_relative_to((ROOT/'artifacts/security/container-scan').resolve())
        scan=json.loads(scanpath.read_text());assert scan['Metadata']['ImageID']==candidate and isinstance(scan.get('Results'),list)
        assert (datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z','+00:00'))).total_seconds()<86400
        assert not any(v['Severity'] in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities',[]))
        js="const fs=require('fs'),c=require('crypto');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/'+f)).digest('hex')]))))"
        actual=json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',candidate,'-e',js,json.dumps(files)]))
        expected={f:hashlib.sha256((folder/'build-context'/pathlib.Path(f).name).read_bytes()).hexdigest() for f in files};assert actual==expected
        # Diff all Docker rootfs layers: candidate must add only this bounded static overlay.
        baseinfo=json.loads(run(['docker','image','inspect',baseline[0]['image']]))[0];info=json.loads(run(['docker','image','inspect',candidate]))[0]
        assert info['RootFS']['Layers'][:-len(files)]==baseinfo['RootFS']['Layers'],'NON_STATIC_BASE_CHANGED'
        ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
        pre=align.check.remote(c,'B',password,align.remote_program('B',baseline,candidate,ca,False),90);assert pre['status']=='PASS'
        result=pre
        if a.apply:
            archive=folder/'candidate.tar';run(['docker','save','-o',str(archive),candidate],180);digest=hashlib.sha256(archive.read_bytes()).hexdigest();remote='/home/server/.prep-image-'+candidate[7:23]+'.tar'
            with c.open_sftp() as sftp:
                sftp.get_channel().settimeout(20);started=time.monotonic()
                def deadline(done,total):
                    if time.monotonic()-started>240:raise TimeoutError('TRANSFER_TIMEOUT')
                sftp.put(str(archive),remote,callback=deadline);sftp.chmod(remote,0o600)
            align.check.remote(c,'B',password,'import pathlib,hashlib,subprocess,json;p=pathlib.Path('+repr(remote)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(digest)+';subprocess.run(["docker","load","-i",str(p)],check=True,capture_output=True,timeout=90);print(json.dumps({"status":"PASS"}))',100)
            result=align.check.remote(c,'B',password,align.remote_program('B',baseline,candidate,ca,True),260)
        result.update(scope='B_CLINICIAN_TOOLS_STATIC_ONLY' if a.tools else 'B_CLINICIAN_HOME_STATIC_ONLY',sourceHashes=actual,review='DRAFT / UNASSIGNED',deployed=a.apply,observedAt=datetime.now(timezone.utc).isoformat())
        (folder/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps({'status':result['status'],'rollback':result['rollback'],'deployed':a.apply,'evidence':str(folder/'result.json')}))
        if result['status']!='PASS':raise SystemExit(2)
    finally:c.close();password=None
if __name__=='__main__':
    raise SystemExit('PARTIAL_CLINICIAN_RELEASE_RETIRED: use clinician-bundle-stage.py and clinician-ui.py build/release; historical overlay helpers remain importable.')
