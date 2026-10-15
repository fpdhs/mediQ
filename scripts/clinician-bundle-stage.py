"""Stage one complete clinician UI candidate; never deploy or change remote state."""
import argparse,base64,getpass,hashlib,importlib.util,json,pathlib,posixpath,re,shutil,subprocess
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bundle_align',ROOT/'scripts/health-helper-align.py')
align=importlib.util.module_from_spec(spec);spec.loader.exec_module(align)
SHEETS=['clinician','clinician-desk','clinician-preparation','clinician-health','viewer-studio','clinician-demo-tools','image-journey']
MENU=[('dashboard','진료 홈'),('records','환자 기록'),('viewer','환자 영상'),('qr','공유 접수'),('transfer','병원 보관함')]
SCHEMA='highpass.clinician-ui/1'

def entry_assets(html):
    """The source page owns stylesheet order and browser entry points."""
    sheets=re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*href="(/[^"]+)"[^>]*>',html)
    scripts=re.findall(r'<script\b[^>]*src="(/[^"]+)"[^>]*></script>',html)
    return sheets,scripts

def region(html,ident):
    start=re.search(r'<div\b[^>]*\bid="'+re.escape(ident)+r'"[^>]*>',html)
    assert start,'REGION_MISSING_'+ident
    depth=0
    for m in re.finditer(r'</?div\b[^>]*>',html[start.start():]):
        depth+=-1 if m.group().startswith('</') else 1
        if depth==0:return start.start(),start.start()+m.end()
    raise AssertionError('REGION_UNBALANCED_'+ident)

def overlay(original,local):
    a,b=region(original,'hospital-saas-app');x,y=region(local,'hospital-saas-app')
    html=original[:a]+local[x:y]+original[b:]
    sheets,scripts=entry_assets(local)
    # Avoid a deployed-only CSS cascade or a deployed-only entry module.
    # Authentication-specific extras belong to the captured host shell.
    tags=re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*href="(/[^"]+)"[^>]*>',original)
    extras=[s for s in tags if s not in sheets]
    html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*href="/[^"]+"[^>]*>','',html)
    html=html.replace('</head>','\n'.join('<link rel="stylesheet" href="'+s+'">' for s in sheets+extras)+'\n</head>',1)
    for script in scripts:
        if re.search(r'<script\b[^>]*src="'+re.escape(script)+r'"',html):continue
        module=' type="module"' if re.search(r'<script\b[^>]*type="module"[^>]*src="'+re.escape(script)+r'"',local) else ''
        html=html.replace('</body>','<script'+module+' src="'+script+'"></script>\n</body>',1)
    pa,pb=region(original,'patient-portal-app');qa,qb=region(html,'patient-portal-app')
    assert original[pa:pb]==html[qa:qb],'PATIENT_HTML_CHANGED'
    assert html.count('src="/app.js"')==1
    assert html.count('id="clinician-tools"')==1
    screens=set(re.findall(r'data-screen="([^"]+)"',html))
    assert set(re.findall(r'data-view-jump="([^"]+)"',html)).issubset(screens),'MISSING_SCREEN'
    for route,label in MENU:assert re.search(r'data-view="'+route+r'"[^>]*>'+label+r'</button>',html)
    return html

def dependencies(local=None):
    # Auth stays byte-for-byte on the captured B image; shared controller dependencies
    # are explicit in the manifest and require patient regression before promotion.
    local=local if local is not None else (ROOT/'public/index.html').read_text(encoding='utf8')
    sheets,scripts=entry_assets(local)
    a,b=region(local,'hospital-saas-app')
    images=re.findall(r'(?:src|href)="(/(?:assets|images|brand)/[^"]+)"',local[a:b])
    files=set();queue=['public'+s for s in sheets+scripts+images]
    while queue:
        name=queue.pop()
        if name in files or name=='public/capstone-auth.js':continue
        p=(ROOT/name).resolve();assert p.is_relative_to((ROOT/'public').resolve()) and p.is_file(),name
        files.add(name)
        if p.suffix not in ['.js','.css']:continue
        source=p.read_text(encoding='utf8')
        refs=re.findall(r'(?:from\s*|import\s*\(|import\s*)[\'\"]([^\'\"]+)[\'\"]',source) if p.suffix=='.js' else []
        refs+=re.findall(r'url\([\'\"]?([^\)\'\"]+)',source)
        refs+=re.findall(r'[\'\"](/(?:assets|images|brand)/[^\'\"\s<>]+\.(?:webp|png|jpg|svg))[\'\"]',source)
        for ref in refs:
            if ref.startswith(('data:','http:','https:','#')):continue
            if not ref.startswith(('/','.')):continue
            resolved='public'+ref if ref.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(name),ref))
            queue.append(resolved.split('?')[0])
    files.update('public/assets/security-journey/'+s+'-v1.webp' for s in ['identity','consent','ticket','policy','token','encryption','view-storage','expiry'])
    files.add('public/assets/security-journey/consent-v2.png')
    return sorted(files)

def source_identity(local=None):
    local=local if local is not None else (ROOT/'public/index.html').read_text(encoding='utf8')
    a,b=region(local,'hospital-saas-app')
    sheets,scripts=entry_assets(local)
    identity=dict(schema=SCHEMA,canonicalSource='public/index.html#hospital-saas-app',
      workspaceSha256=hashlib.sha256(local[a:b].encode()).hexdigest(),stylesheets=sheets,scripts=scripts,
      sourceHashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in dependencies(local)})
    identity['revision']=hashlib.sha256(json.dumps(identity,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return identity

def stage(original,baseline,capture_mode='live'):
    local=(ROOT/'public/index.html').read_text(encoding='utf8');html=overlay(original,local)
    identity=source_identity(local)
    files=['public/index.html','public/clinician-ui-version.js']+dependencies(local)
    folder=ROOT/'artifacts/workstation'/('clinician-bundle-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'));folder.mkdir(parents=True,exist_ok=False)
    context=folder/'build-context';context.mkdir()
    for name in files:
        dest=context/name;dest.parent.mkdir(parents=True,exist_ok=True)
        if name=='public/index.html':dest.write_text(html,encoding='utf8',newline='')
        elif name=='public/clinician-ui-version.js':dest.write_text('export default '+json.dumps(identity,indent=2)+';\n',encoding='utf8')
        else:shutil.copyfile(ROOT/name,dest)
    base=baseline[0]['image']
    (context/'Dockerfile').write_text('ARG CAPSTONE_BASE_IMAGE\nFROM ${CAPSTONE_BASE_IMAGE}\nCOPY public/ /app/public/\n',encoding='utf8')
    (folder/'baseline.json').write_text(json.dumps(baseline,indent=2))
    (folder/'baseline-index.html').write_text(original,encoding='utf8',newline='')
    pa,pb=region(original,'patient-portal-app')
    manifest=dict(scope='COMPLETE_CLINICIAN_UI_CANDIDATE',review='DRAFT / UNASSIGNED',deployed=False,base=base,
      schema=SCHEMA,sourceRevision=identity['revision'],canonicalSource=identity['canonicalSource'],captureMode=capture_mode,overlayLayers=1,
      head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),dirty=bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT)),
      menus=MENU,patientHtmlSha256=hashlib.sha256(original[pa:pb].encode()).hexdigest(),
      preserved=['server','DB','PACS','public/capstone-auth.js','public/mobile','patient portal HTML'],
      sharedControllerChanged=True,requiredPromotionGates=['actual candidate clinician login and every menu','patient login and sharing regression','same deployment API compatibility and policy denial','container scan','review','rollback'],
      hashes={f:hashlib.sha256((context/f).read_bytes()).hexdigest() for f in files})
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=True,indent=2))
    return dict(folder=str(folder),base=base,files=len(files),sourceRevision=identity['revision'],captureMode=capture_mode,deployed=False,review=manifest['review'])

def main():
    parser=argparse.ArgumentParser(description='Build one clinician UI from public/index.html and its dependency closure.')
    parser.add_argument('--baseline-folder',help='Use a captured baseline offline; this does not attest current B runtime.')
    args=parser.parse_args()
    if args.baseline_folder:
        folder=(ROOT/args.baseline_folder).resolve()
        assert folder.is_relative_to((ROOT/'artifacts/workstation').resolve())
        baseline=json.loads((folder/'baseline.json').read_text(encoding='utf8'))
        original=(folder/'baseline-index.html').read_bytes().decode('utf8')
        capture_mode='snapshot'
    else:
        password=getpass.getpass('B VM password (concealed, never saved): ')
        client=align.check.connect('B',password)
        try:
            baseline=align.check.inventory(client,'B',password);assert baseline[0]['health']=='healthy'
            js="process.stdout.write(require('fs').readFileSync('/app/public/index.html'))"
            data=align.check.remote(client,'B',password,'import subprocess,base64,json;print(json.dumps({"html":base64.b64encode(subprocess.check_output(["docker","exec",'+repr(baseline[0]['id'])+',"/nodejs/bin/node","-e",'+repr(js)+'],timeout=10)).decode()}))',20)
        finally:client.close();password=None
        original=base64.b64decode(data['html']).decode();capture_mode='live'
    print(json.dumps(stage(original,baseline,capture_mode)))
if __name__=='__main__':main()
