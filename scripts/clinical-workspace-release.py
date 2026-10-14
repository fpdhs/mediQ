"""Capture, build and promote a clinician-only UI overlay on the existing Azure web."""
import argparse, base64, hashlib, importlib.util, json, os, pathlib, subprocess, time, urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
ORIGIN = 'https://highpass-demo.japaneast.cloudapp.azure.com'
NAME = 'hp-public-web-web-1'
ASSETS = ['public/ui/clinical-workspace.css', 'public/ui/clinician-home.js', 'public/app.js']

def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT/file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

runtime = load('clinical_runtime', 'scripts/health-helper-runtime-check.py')
bundle = load('clinical_bundle', 'scripts/clinician-bundle-stage.py')

def sha(data): return hashlib.sha256(data).hexdigest()
def run(args, timeout=60): return subprocess.check_output(args, cwd=ROOT, stderr=subprocess.PIPE, timeout=timeout)
def source():
    html = (ROOT/'public/index.html').read_text(encoding='utf8')
    a,b = bundle.region(html, 'hospital-saas-app')
    return html[a:b], {name:sha((ROOT/name).read_bytes()) for name in ASSETS}

def dark_viewer_markup(html):
    start=html.index('<section class="mq-screen" id="viewer-screen"')
    end=html.index('</section>',start)+len('</section>')
    viewer=html[start:end]
    changes={
      '<span class="studio-synthetic">합성 시연</span>':'',
      '<div class="watermark-overlay" id="viewer-watermark">합성 시연 영상 · 임상 판단 금지</div>':'<div class="watermark-overlay" id="viewer-watermark"></div>',
      '<small>합성 데이터로 구성된 시연 환경입니다.</small>':'',
      '<footer class="studio-footnote"><span>합성 시연 영상 · 임상 판단 금지</span>':'<footer class="studio-footnote">',
    }
    for old,new in changes.items():
        assert viewer.count(old)==1,'VIEWER_PATCH_ANCHOR_CHANGED'
        viewer=viewer.replace(old,new,1)
    return html[:start]+viewer+html[end:]

def stage(journey_art=False, glass_ui=False, viewer_dark=False):
    client = runtime.connect('CLOUD', None)
    try:
        baseline = runtime.remote(client, 'CLOUD', None, '''import subprocess,json,base64
names=['hp-public-web-web-1','hp-capstone-control-control-1','hp-public-web-waf-1','hp-capstone-control-postgres-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15))
web=items[0];assert web['State']['Running']
assert all(not m['Destination'].startswith('/app/public') for m in web['Mounts'])
html=subprocess.check_output(['docker','exec',web['Id'],'/nodejs/bin/node','-e',"process.stdout.write(require('fs').readFileSync('/app/public/index.html'))"],timeout=15)
print(json.dumps(dict(containers=[dict(name=i['Name'],id=i['Id'],image=i['Image']) for i in items],html=base64.b64encode(html).decode())))
''', 40)
    finally: client.close()
    base = baseline['containers'][0]['image']
    assert run(['docker','image','inspect',base,'--format','{{.Id}}']).decode().strip() == base
    original = base64.b64decode(baseline.pop('html'))
    base_files = json.loads(run(['docker','run','--rm',base,'-e',"const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(['index.html','app.js','ui/security-gates.js','ui/image-journey.js'].map(p=>[p,fs.readFileSync('/app/public/'+p).toString('base64')]))))"],180))
    # Only screen labels may change in the shared application controller.
    base_app = base64.b64decode(base_files['app.js']).decode('utf8')
    local_app = (ROOT/'public/app.js').read_text(encoding='utf8')
    def without_titles(app):
        start=app.index('  const screenMeta = {');end=app.index('\n  };',start)+5
        return app[:start]+app[end:]
    if viewer_dark:
        pass
    elif glass_ui:
        journey=base64.b64decode(base_files['ui/image-journey.js']).decode('utf8').replace('\r\n','\n')
        if "import {mountJourneyLens}" not in journey:
            journey=journey.replace("import {SECURITY_GATES} from './security-gates.js';", "import {SECURITY_GATES} from './security-gates.js';\nimport {mountJourneyLens} from './journey-lens.js';")
            journey=journey.replace("  let mode='view',index=0,scenario='normal',overview=true;", "  let mode='view',index=0,scenario='normal',overview=true;\n  const lens=mountJourneyLens(root);")
            journey=journey.replace('    root.dataset.overview=String(overview);', '    root.dataset.overview=String(overview);\n    lens.update(model,overview);')
        assert journey==(ROOT/'public/ui/image-journey.js').read_text(encoding='utf8'), 'UNRELATED_JOURNEY_CHANGE'
    elif not journey_art:
        assert without_titles(base_app)==without_titles(local_app), 'UNRELATED_SHARED_CONTROLLER_CHANGE'
    else:
        old_gate=base64.b64decode(base_files['ui/security-gates.js']).decode('utf8')
        expected=old_gate.replace("'환자가 검사와 공유 범위를 직접 고르는 장면'", "'파란 의료지갑에서 선택한 영상 카드와 공유할 병원·기간을 나타내는 입체 일러스트'").replace('image:`/assets/security-journey/${illustrationNames[index]}-v1.webp`', "image:index===1 ? '/assets/security-journey/consent-v2.png' : `/assets/security-journey/${illustrationNames[index]}-v1.webp`")
        assert expected==(ROOT/'public/ui/security-gates.js').read_text(encoding='utf8'), 'UNRELATED_GATE_CHANGE'
    base_html = base64.b64decode(base_files['index.html'])
    assert original == base_html, 'LIVE_FILES_DIFFER_FROM_IMAGE'
    workspace, hashes = source()
    old = original.decode('utf8'); a,b = bundle.region(old,'hospital-saas-app')
    html = old[:a] + workspace + old[b:]
    sheet = '<link rel="stylesheet" href="/ui/clinical-workspace.css">'
    if sheet not in html: html = html.replace('</head>', '  '+sheet+'\n</head>', 1)
    if journey_art or glass_ui or viewer_dark:
        html=old
        a,b=bundle.region(old,'hospital-saas-app');workspace=old[a:b]
    if glass_ui:
        for name in ['clinical-glass','journey-glass']:
            tag='<link rel="stylesheet" href="/ui/'+name+'.css">'
            if tag not in html:html=html.replace('</head>',tag+'\n</head>',1)
    if viewer_dark:
        html=dark_viewer_markup(old)
        a,b=bundle.region(html,'hospital-saas-app');workspace=html[a:b]
    a,b = bundle.region(old,'patient-portal-app'); x,y = bundle.region(html,'patient-portal-app')
    assert old[a:b] == html[x:y], 'PATIENT_CHANGED'
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder=ROOT/'artifacts/azure'/('clinical-workspace-'+stamp)
    context=folder/'context';context.mkdir(parents=True)
    files={name:(ROOT/name).read_bytes() for name in ASSETS}
    if journey_art:
        files={name:(ROOT/name).read_bytes() for name in ['public/ui/security-gates.js','public/assets/security-journey/consent-v2.png']}
        hashes={name:sha(data) for name,data in files.items()}
    if glass_ui:
        files={name:(ROOT/name).read_bytes() for name in ['public/ui/clinical-glass.css','public/ui/journey-glass.css','public/ui/journey-lens.js','public/ui/image-journey.js']}
        hashes={name:sha(data) for name,data in files.items()}
    if viewer_dark:
        files={'public/ui/clinical-glass.css':(ROOT/'public/ui/clinical-glass.css').read_bytes()}
        hashes={name:sha(data) for name,data in files.items()}
    if not journey_art:files['public/index.html']=html.encode()
    for name,data in files.items():
        dest=context/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    base_info=json.loads(run(['docker','image','inspect',base]))[0]
    tag='highpass-clinical-base:'+base[7:23]
    run(['docker','tag',base,tag])
    (context/'Dockerfile').write_text('FROM '+tag+'\nCOPY public/ /app/public/\n')
    candidate='highpass-clinical-workspace:'+stamp.lower()
    progress=[] if os.environ.get('DOCKER_BUILDKIT')=='0' else ['--progress=plain']
    build=subprocess.run(['docker','build',*progress,'--network=none','--pull=false','-t',candidate,str(context)],cwd=ROOT,capture_output=True,timeout=300)
    (folder/'build.log').write_bytes(build.stdout+build.stderr)
    assert build.returncode == 0, 'BUILD_FAILED'
    image=run(['docker','image','inspect',candidate,'--format','{{.Id}}']).decode().strip()
    layers=json.loads(run(['docker','image','inspect',base,image]))
    assert layers[1]['RootFS']['Layers'][:len(layers[0]['RootFS']['Layers'])] == layers[0]['RootFS']['Layers'], 'BASE_LAYERS_CHANGED'
    assert len(layers[1]['RootFS']['Layers'])==len(layers[0]['RootFS']['Layers'])+1, 'UNEXPECTED_LAYER_COUNT'
    assert layers[1]['Config']==base_info['Config'], 'IMAGE_RUNTIME_CONFIG_CHANGED'
    manifest=dict(base=base,image=image,tag=candidate,workspaceSha256=sha(workspace.encode()),sourceHashes=hashes,
                  hashes={name:sha(data) for name,data in files.items()},baseline=baseline,
                  origin=ORIGIN,scope='VIEWER_DARK_UI' if viewer_dark else 'CLINICAL_GLASS_UI' if glass_ui else 'JOURNEY_ART_ONLY' if journey_art else 'CLINICIAN_UI_ONLY',deployed=False)
    actual=json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',image,'-e',"const fs=require('fs'),c=require('crypto');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,c.createHash('sha256').update(fs.readFileSync('/app/'+p)).digest('hex')]))))",json.dumps(list(manifest['hashes']))],180))
    assert actual==manifest['hashes'], 'IMAGE_ASSET_MISMATCH'
    (folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
    return dict(folder=str(folder),image=image,files=len(files),status='PASS',deployed=False)

def get(url):
    req=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=20) as response:
        assert response.geturl()==url, 'REDIRECT'
        return response.read(16*1024*1024)

def verify(manifest):
    html=get(ORIGIN+'/hipass/').decode('utf8')
    a,b=bundle.region(html,'hospital-saas-app')
    assert sha(html[a:b].encode())==manifest['workspaceSha256'], 'SERVED_WORKSPACE_DIFFERS'
    assert '<link rel="stylesheet" href="/ui/clinical-workspace.css">' in html
    if manifest['scope']=='VIEWER_DARK_UI':
        assert '<body><aside style="background:#edf3fa;color:#243c5b;padding:8px;text-align:center;' in html,'PUBLIC_NOTICE_SELECTOR_CHANGED'
    if manifest['scope']=='CLINICAL_GLASS_UI':
        for name in ['clinical-glass','journey-glass']:assert '<link rel="stylesheet" href="/ui/'+name+'.css">' in html
    for name in manifest['sourceHashes']:
        assert sha(get(ORIGIN+'/'+name.removeprefix('public/')))==manifest['hashes'][name], 'SERVED_ASSET_DIFFERS'
    return dict(status='PASS',scope='SERVED_CLINICIAN_UI',origin=ORIGIN)

def deploy(folder, scan):
    folder=folder.resolve();assert folder.is_relative_to((ROOT/'artifacts/azure').resolve())
    manifest=json.loads((folder/'manifest.json').read_text())
    workspace,_=source()
    hashes={name:sha((ROOT/name).read_bytes()) for name in manifest['sourceHashes']}
    assert (manifest['scope'] in ['JOURNEY_ART_ONLY','CLINICAL_GLASS_UI','VIEWER_DARK_UI'] or sha(workspace.encode())==manifest['workspaceSha256']) and hashes==manifest['sourceHashes'], 'SOURCE_CHANGED_RESTAGE'
    for name,digest in manifest['hashes'].items(): assert sha((folder/'context'/name).read_bytes())==digest
    report=json.loads(pathlib.Path(scan).read_text(encoding='utf8'))
    assert report['Metadata']['ImageID']==manifest['image'], 'SCAN_IMAGE_MISMATCH'
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(report['CreatedAt'].replace('Z','+00:00'))).total_seconds()
    assert 0<=age<86400 and isinstance(report.get('Results'),list), 'SCAN_EXPIRED'
    assert not any(v['Severity'] in ['HIGH','CRITICAL'] for row in report['Results'] for v in row.get('Vulnerabilities',[])), 'SCAN_FAILED'
    archive=folder/'image.tar';run(['docker','save','-o',str(archive),manifest['image']],180)
    with archive.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
    remote_folder='/home/highpassadmin/.'+folder.name
    client=runtime.connect('CLOUD',None)
    result=dict(status='FAIL',deployed=False,image=manifest['image'],rollback='NOT_NEEDED')
    try:
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(30);sftp.mkdir(remote_folder,0o700)
            started=time.monotonic()
            def progress(done,total):
                if time.monotonic()-started>240: raise TimeoutError('UPLOAD_TIMEOUT')
            sftp.put(str(archive),remote_folder+'/image.tar',callback=progress);sftp.chmod(remote_folder+'/image.tar',0o600)
        program='STAGE='+repr(remote_folder)+'\nMANIFEST='+repr(manifest)+'\nDIGEST='+repr(digest)+'\n'+r'''
import subprocess,json,pathlib,hashlib,os,time
folder=pathlib.Path(STAGE)
def run(args):return subprocess.check_output(args,stderr=subprocess.PIPE,timeout=120)
def inspect(name):return json.loads(run(['docker','inspect',name]))[0]
for item in MANIFEST['baseline']['containers']:
 current=inspect(item['name']);assert current['Id']==item['id'] and current['Image']==item['image'],'BASELINE_CHANGED'
old=inspect('hp-public-web-web-1');labels=old['Config']['Labels']
assert labels['com.docker.compose.project']=='hp-public-web'
files=labels['com.docker.compose.project.config_files'].split(',')
args=['docker','compose','--project-directory',labels['com.docker.compose.project.working_dir'],'-p','hp-public-web']
for file in files:args+=['-f',file]
config=json.loads(run(args+['config','--format','json']))
assert config['services']['web']['image']==MANIFEST['base'],'COMPOSE_IMAGE_DRIFT'
with (folder/'image.tar').open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==DIGEST
run(['docker','load','-i',str(folder/'image.tar')])
before=folder/'before.json';before.write_text(json.dumps(config));os.chmod(before,0o600)
config['services']['web']['image']=MANIFEST['image']
after=folder/'compose.json';after.write_text(json.dumps(config));os.chmod(after,0o600)
def switch(file):run(['docker','compose','-p','hp-public-web','-f',str(file),'up','-d','--no-deps','--pull','never','web'])
try:
 switch(after)
 current=inspect('hp-public-web-web-1')
 assert current['Image']==MANIFEST['image'] and current['State']['Running']
 assert current['Config']['Env']==old['Config']['Env'] and current['Mounts']==old['Mounts'],'RUNTIME_CHANGED'
 assert current['HostConfig']['PortBindings']==old['HostConfig']['PortBindings'],'PORTS_CHANGED'
 assert current['HostConfig']['ReadonlyRootfs']==old['HostConfig']['ReadonlyRootfs']
 for item in MANIFEST['baseline']['containers'][1:]:assert inspect(item['name'])['Id']==item['id'],'OTHER_CONTAINER_CHANGED'
except Exception:
 switch(before);assert inspect('hp-public-web-web-1')['Image']==MANIFEST['base'];raise
print(json.dumps(dict(status='PASS',deployed=True,controlUnchanged=True,rollbackPath=str(before))))
'''
        result.update(runtime.remote(client,'CLOUD',None,program,240))
        try:
            for attempt in range(5):
                try: parity=verify(manifest);break
                except Exception:
                    if attempt==4:raise
                    time.sleep(2)
            result['parity']=parity
        except Exception:
            rollback='import subprocess,json; subprocess.check_output('+repr(['docker','compose','-p','hp-public-web','-f',remote_folder+'/before.json','up','-d','--no-deps','--pull','never','web'])+',stderr=subprocess.PIPE,timeout=120); print(json.dumps({"status":"PASS"}))'
            result.update(status='FAIL',deployed=False,rollback=runtime.remote(client,'CLOUD',None,rollback,130)['status'])
            raise
    finally:
        client.close();(folder/'deployment.json').write_text(json.dumps(result,indent=2))
    return result

def main():
    global ASSETS
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['stage','deploy','verify'])
    parser.add_argument('--folder',type=pathlib.Path);parser.add_argument('--scan')
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--journey-art',action='store_true',help='Replace only the consent illustration and its reference; preserve all host HTML.')
    mode.add_argument('--glass-ui',action='store_true',help='Add clinician glass styles and educational journey interaction; preserve host workspace and authentication.')
    mode.add_argument('--viewer-dark',action='store_true',help='Dark viewer chrome and remove viewer-only demo labels; preserve access controls and runtime notices elsewhere.')
    args=parser.parse_args()
    if args.journey_art:ASSETS=['public/ui/security-gates.js','public/assets/security-journey/consent-v2.png']
    if args.glass_ui:ASSETS=['public/ui/clinical-glass.css','public/ui/journey-glass.css','public/ui/journey-lens.js','public/ui/image-journey.js']
    if args.viewer_dark:ASSETS=['public/ui/clinical-glass.css']
    if args.command=='stage': result=stage(args.journey_art,args.glass_ui,args.viewer_dark)
    elif args.command=='deploy': result=deploy(args.folder,args.scan)
    else: result=verify(json.loads((args.folder/'manifest.json').read_text()))
    print(json.dumps(result))

if __name__=='__main__':main()
