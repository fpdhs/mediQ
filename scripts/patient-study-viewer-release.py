"""Scoped patient UI/metadata update on the existing VM. No clinical proxy activation."""
import argparse,base64,hashlib,importlib.util,json,pathlib,re,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('task_release',ROOT/'scripts/patient-task-ui-release.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
support=base.support
FILES=['public/app.js','public/index.html','public/ui/patient-share-review.js','public/patient-pixel-viewer.js','public/mobile/sw.js','scripts/start-public-web.js']
NEW=['public/ui/patient-pixel-viewer.css']
def once(text,old,new):
    assert text.count(old)==1,'EXACT_PATCH_ANCHOR_REQUIRED'
    return text.replace(old,new,1)
def function(text,name):
    value=re.search(r'(?:async )?function '+name+r'\([\s\S]*?\n\}',text)
    assert value,'FUNCTION_NOT_FOUND'
    return value.group()
def transform(name,text):
    local=(ROOT/name).read_text(encoding='utf8')
    if name=='public/app.js':
        for name in ['fetchDashboardSnapshot','loadPhrDashboard','renderPatientStudyOptions','selectStudy','loadDashboard']:
            text=once(text,function(text,name),function(local,name))
        anchor='function renderPatientStudyOptions(studies) {'
        text=once(text,anchor,function(local,'applyPatientStudySnapshot')+'\n\n'+anchor)
        text=once(text,'let shareReview = null;','let shareReview = null;\nlet patientStudySnapshotAvailable = false;')
        anchor='  patientStudySelect?.addEventListener("change", () => selectStudy(patientStudySelect.value, lastStudies));'
        start=local.index(anchor);end=local.index('  patientSeriesSelect?.addEventListener',start)
        text=once(text,anchor+'\n',local[start:end])
        old='  study:lastStudies.find(row=>row.studyInstanceUid===patientStudySelect?.value), seriesUid:patientSeriesSelect?.value,'
        text=once(text,old,next(x for x in local.splitlines() if 'study:patientStudySnapshotAvailable ?' in x))
        return text
    if name=='public/index.html':
        old=next(x for x in text.splitlines() if '<section class="share-exam">' in x)
        text=once(text,old,next(x for x in local.splitlines() if '<section class="share-exam">' in x))
        old='<select id="patient-study-select" class="select" aria-label="대상 영상 선택"></select>'
        start=local.index('<select id="patient-study-select"');end=local.index('</button>',start)+len('</button>')
        return once(text,old,local[start:end])
    if name=='scripts/start-public-web.js':
        anchor=" ['GET',/^\\/api\\/(imaging-studies|hospitals|consents|transfers\\/requests)$/],"
        return once(text,anchor,anchor+'\n'+next(x for x in local.splitlines() if "patients\\/" in x and "consents$/" in x))
    if name=='public/mobile/sw.js':
        version=re.search(r'const CACHE_NAME = "([^"]+)";',text).group()
        text=once(text,version,'const CACHE_NAME = "hipass-mediq-shell-v45";')
        return once(text,'  "/patient-pixel-viewer.js",','  "/patient-pixel-viewer.js",\n  "/ui/patient-pixel-viewer.css",')
    # These two modules were clean before this task; require the exact Git baseline.
    import subprocess
    original=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT).decode().replace('\r\n','\n')
    assert text==original,'LIVE_MODULE_DRIFT_'+name
    return local
def stage():
    folder=support.config.protected_folder();client=support.runtime.connect('CLOUD',None)
    try:
        result=support.runtime.remote(client,'CLOUD',None,"""
import subprocess,json
names=['hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-control-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names]));assert all(i['State']['Running'] for i in items)
code="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.readFileSync('/app/'+p).toString('base64')]))))"
files=json.loads(subprocess.check_output(['docker','exec',items[0]['Id'],'/nodejs/bin/node','-e',code,"""+repr(json.dumps(FILES))+"""]))
print(json.dumps({'baseline':[{'name':i['Name'],'id':i['Id'],'image':i['Image']} for i in items],'files':files}))
""",45)
        (folder/'baseline.json').write_text(json.dumps(result))
        staged='/home/highpassadmin/.highpass-task-ui-'+folder.name
        manifest={'stage':staged,'baseline':result['baseline'],'hashes':{},'review':'DRAFT / UNASSIGNED','scope':'patient metadata and dark viewer UI; no clinical routes, auth mapping or backend changes'}
        files={name:transform(name,base64.b64decode(value).decode().replace('\r\n','\n')) for name,value in result['files'].items()}
        files.update({name:(ROOT/name).read_text(encoding='utf8') for name in NEW})
        manifest['baselineScriptHash']=hashlib.sha256(base64.b64decode(result['files']['scripts/start-public-web.js'])).hexdigest()
        with client.open_sftp() as ftp:
            ftp.mkdir(staged,0o700)
            for name,text in files.items():
                dest=folder/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text,encoding='utf8',newline='\n')
                for parent in reversed(pathlib.PurePosixPath(name).parents):
                    if str(parent)=='.':continue
                    try:ftp.mkdir(staged+'/'+str(parent),0o755)
                    except OSError:pass
                ftp.put(str(dest),staged+'/'+name);ftp.chmod(staged+'/'+name,0o644)
                manifest['hashes'][name]=hashlib.sha256(dest.read_bytes()).hexdigest()
        (folder/'manifest.json').write_text(json.dumps(manifest,indent=2));return {'folder':str(folder),'status':'STAGED'}
    finally:client.close()
def operation(folder,phase):
    manifest=json.loads((folder/'manifest.json').read_text());client=support.runtime.connect('CLOUD',None)
    program=once(base.REMOTE,"assert old_script.is_file() and '인터넷 합성 시연 · CT 열람/전송' in old_script.read_text(),'SCRIPT_CONTENT_CHANGED'", "assert old_script.is_file() and hashlib.sha256(old_script.read_bytes()).hexdigest()==M['baselineScriptHash'],'SCRIPT_CONTENT_CHANGED'")
    try:result=support.runtime.remote(client,'CLOUD',None,'M='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+program,300)
    finally:client.close()
    if phase=='build':manifest['candidate']=result;(folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
    (folder/(phase+'.json')).write_text(json.dumps(result,indent=2));return result
def verify(folder):
    m=json.loads((folder/'manifest.json').read_text());checks=[]
    for name,digest in m['hashes'].items():
        if not name.startswith('public/'):continue
        url=support.ORIGIN+('/hipass/' if name=='public/index.html' else '/'+name.removeprefix('public/'))
        with urllib.request.urlopen(url,timeout=20) as r:content=r.read()
        if name=='public/index.html':content=content.replace(b'<html lang="ko" data-capstone="1">',b'<html lang="ko">')
        assert hashlib.sha256(content).hexdigest()==digest,'SERVED_HASH_MISMATCH'
        checks.append({'path':name,'result':'PASS'})
    for path,status,code in [('/api/patients/MEDIQ-SYN-HCC-001/consents',401,'AUTHENTICATION_REQUIRED'),('/api/health',403,'PUBLIC_ROUTE_NOT_ENABLED'),('/patient-dicomweb/studies',403,'PUBLIC_ROUTE_NOT_ENABLED')]:
        try:urllib.request.urlopen(support.ORIGIN+path,timeout=20);raise AssertionError('UNEXPECTED_ACCESS')
        except urllib.error.HTTPError as error:assert error.code==status and json.loads(error.read()).get('error')==code
        checks.append({'path':path,'result':'PASS','status':status,'code':code})
    result={'checks':checks,'authenticatedBrowser':'NOT VERIFIED','review':'DRAFT / UNASSIGNED'}
    (folder/'verify.json').write_text(json.dumps(result,indent=2));return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('phase',choices=['stage','build','deploy','verify','rollback']);p.add_argument('--folder',type=pathlib.Path);a=p.parse_args()
    if a.folder:assert a.folder.resolve().is_relative_to(ROOT/'artifacts/azure')
    print(json.dumps(stage() if a.phase=='stage' else verify(a.folder) if a.phase=='verify' else operation(a.folder,a.phase)),flush=True)
