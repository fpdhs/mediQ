"""B portal static security illustrations overlay; pinned SSH and image rollback."""
import argparse,base64,getpass,hashlib,importlib.util,json,pathlib,re,shutil,subprocess,time
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('journey_align',ROOT/'scripts/health-helper-align.py')
align=importlib.util.module_from_spec(spec);spec.loader.exec_module(align)
FILES=['public/index.html','public/ui/image-journey.css','public/ui/image-journey.js','public/ui/security-gates.js']
FILES += ['public/assets/security-journey/'+name+'-v1.webp' for name in ['identity','consent','ticket','policy','token','encryption','view-storage','expiry']]

def run(args,seconds=120):
    return subprocess.run(args,cwd=ROOT,capture_output=True,check=True,timeout=seconds).stdout

def root_range(html):
    start=html.find('<div id="image-journey"')
    if start<0:return None
    depth=0
    for match in re.finditer(r'</?div\b[^>]*>',html[start:]):
        depth+=-1 if match.group().startswith('</') else 1
        if depth==0:return (start,start+match.end())
    raise RuntimeError('JOURNEY_ROOT_UNBALANCED')

def overlay(original,local):
    bounds=root_range(local);assert bounds
    root=local[bounds[0]:bounds[1]]
    existing=root_range(original)
    if existing:html=original[:existing[0]]+root+original[existing[1]:]
    else:
        section=re.search(r'<section\b[^>]*data-screen="exchange"[^>]*>',original)
        assert section,'EXCHANGE_ROUTE_MISSING'
        depth=1;end=None
        for match in re.finditer(r'</?section\b[^>]*>',original[section.end():]):
            depth+=-1 if match.group().startswith('</') else 1
            if depth==0:end=section.end()+match.start();break
        assert end,'EXCHANGE_SECTION_UNBALANCED'
        old=original[section.end():end]
        html=original[:section.end()]+root+'<details class="journey-existing"><summary>기존 공유 정보와 실제 요청 도구</summary>'+old+'</details>'+original[end:]
    html=re.sub(r'(<button\b[^>]*data-view="exchange"[^>]*>)([\s\S]*?)(</button>)',lambda m:m[1]+'영상 보안 여정'+m[3],html,count=1)
    for tag in ['<link rel="stylesheet" href="/ui/image-journey.css">','<script type="module" src="/ui/image-journey.js"></script>']:
        if tag not in html:
            marker='</head>' if tag.startswith('<link') else '</body>'
            html=html.replace(marker,tag+'\n'+marker,1)
    return html

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--stage',action='store_true');parser.add_argument('--folder');parser.add_argument('--image');parser.add_argument('--scan');parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    password=getpass.getpass('B VM password (concealed, never saved): ')
    client=align.check.connect('B',password)
    try:
        current=align.check.inventory(client,'B',password)
        assert current[0]['health']=='healthy'
        if args.stage:
            js="process.stdout.write(require('fs').readFileSync('/app/public/index.html'))"
            data=align.check.remote(client,'B',password,'import subprocess,base64,json;print(json.dumps({"html":base64.b64encode(subprocess.check_output(["docker","exec",'+repr(current[0]['id'])+',"/nodejs/bin/node","-e",'+repr(js)+'],timeout=10)).decode()}))',20)
            original=base64.b64decode(data['html']).decode();html=overlay(original,(ROOT/'public/index.html').read_text(encoding='utf8'))
            folder=ROOT/'artifacts/workstation'/('security-journey-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
            context=folder/'build-context';context.mkdir()
            (folder/'baseline.json').write_text(json.dumps(current,indent=2));(folder/'baseline-index.html').write_text(original,encoding='utf8')
            for name in FILES:
                target=context/name;target.parent.mkdir(parents=True,exist_ok=True)
                if name=='public/index.html':target.write_text(html,encoding='utf8')
                else:shutil.copyfile(ROOT/name,target)
            (context/'Dockerfile').write_text('ARG CAPSTONE_BASE_IMAGE\nFROM ${CAPSTONE_BASE_IMAGE}\n'+''.join('COPY '+name+' /app/'+name+'\n' for name in FILES),encoding='utf8')
            hashes={name:hashlib.sha256((context/name).read_bytes()).hexdigest() for name in FILES}
            (folder/'manifest.json').write_text(json.dumps(dict(review='DRAFT / UNASSIGNED',scope='SECURITY_JOURNEY_STATIC_ONLY',hashes=hashes),indent=2))
            print(json.dumps(dict(folder=str(folder),base=current[0]['image'],health=current[0]['health'],scope='STATIC_CANDIDATE_STAGED',files=len(FILES))));return
        assert args.folder and args.image and args.scan
        folder=(ROOT/args.folder).resolve();assert folder.is_relative_to((ROOT/'artifacts/workstation').resolve())
        baseline=json.loads((folder/'baseline.json').read_text());assert current[0]['id']==baseline[0]['id'] and current[0]['image']==baseline[0]['image'],'BASELINE_CHANGED'
        candidate=run(['docker','image','inspect',args.image,'--format','{{.Id}}']).decode().strip();assert re.fullmatch('sha256:[a-f0-9]{64}',candidate)
        scan=json.loads((ROOT/args.scan).read_text());assert scan['Metadata']['ImageID']==candidate and isinstance(scan.get('Results'),list)
        assert (datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z','+00:00'))).total_seconds()<86400
        assert not any(v['Severity'] in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities',[]))
        js="const fs=require('fs'),c=require('crypto');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/'+f)).digest('hex')]))))"
        actual=json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',candidate,'-e',js,json.dumps(FILES)]))
        assert actual==json.loads((folder/'manifest.json').read_text())['hashes']
        baseinfo=json.loads(run(['docker','image','inspect',baseline[0]['image']]))[0];info=json.loads(run(['docker','image','inspect',candidate]))[0]
        assert info['RootFS']['Layers'][:-len(FILES)]==baseinfo['RootFS']['Layers'],'NON_STATIC_BASE_CHANGED'
        ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
        pre=align.check.remote(client,'B',password,align.remote_program('B',baseline,candidate,ca,False),90)
        assert pre['status']=='PASS',pre
        result=pre
        if args.apply:
            archive=folder/'candidate.tar';run(['docker','save','-o',str(archive),candidate],180);digest=hashlib.sha256(archive.read_bytes()).hexdigest();remote='/home/server/.journey-image-'+candidate[7:23]+'.tar'
            with client.open_sftp() as sftp:
                sftp.get_channel().settimeout(20);started=time.monotonic()
                def deadline(done,total):
                    if time.monotonic()-started>240:raise TimeoutError('TRANSFER_TIMEOUT')
                sftp.put(str(archive),remote,callback=deadline);sftp.chmod(remote,0o600)
            align.check.remote(client,'B',password,'import pathlib,hashlib,subprocess,json;p=pathlib.Path('+repr(remote)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(digest)+';subprocess.run(["docker","load","-i",str(p)],check=True,capture_output=True,timeout=90);print(json.dumps({"status":"PASS"}))',100)
            result=align.check.remote(client,'B',password,align.remote_program('B',baseline,candidate,ca,True),260)
        result.update(scope='SECURITY_JOURNEY_STATIC_ONLY',sourceHashes=actual,review='DRAFT / UNASSIGNED',deployed=args.apply,observedAt=datetime.now(timezone.utc).isoformat())
        (folder/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(dict(status=result['status'],rollback=result['rollback'],deployed=args.apply,evidence=str(folder/'result.json'))))
        if result['status']!='PASS':raise SystemExit(2)
    finally:client.close();password=None

if __name__=='__main__':
    raise SystemExit('PARTIAL_CLINICIAN_RELEASE_RETIRED: use clinician-bundle-stage.py and clinician-ui.py build/release; historical overlay helpers remain importable.')
