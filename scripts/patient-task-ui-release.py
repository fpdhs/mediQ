"""Web-only existing Azure VM overlay. DRAFT / UNASSIGNED; no API/policy changes."""
import argparse,base64,hashlib,json,pathlib,subprocess,urllib.request
import importlib.util
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('records_release',ROOT/'scripts/scenario-health-release.py')
support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)
FILES=['public/index.html','public/ui/patient-health.js','public/ui/patient-helper.js','public/ui/patient-typography.css','public/ui/patient-wallet-experience.css','scripts/start-public-web.js']
def once(text,old,new):
    assert text.count(old)==1,'PATCH_ANCHOR_CHANGED'
    return text.replace(old,new,1)
def transform(name,text):
    if name.endswith('patient-wallet-experience.css'):
        text=once(text,'h1{font-size:32px;line-height:1.35;','h1{font-size:var(--hp-patient-page-title);line-height:1.35;')
        text=once(text,'h1{font-size:27px}','h1{font-size:var(--hp-patient-page-title)}')
        text=once(text,'#patient-portal-app [data-wallet-theme=requests] .history-heading{border-top:4px solid var(--wallet-accent);padding:24px;background:var(--wallet-paper);border-radius:8px 8px 0 0}', '#patient-portal-app [data-wallet-theme=requests] .history-heading{border:0;padding:0;background:none;margin:12px 0 24px}')
        local=(ROOT/name).read_text(encoding='utf8');marker='/* Shared extracted card:'
        assert marker not in text
        return text+local[local.index(marker):]
    if name.endswith('.css'):
        before=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT).decode().replace('\r\n','\n')
        assert text==before,'CSS_BASELINE_CHANGED_'+name
        return (ROOT/name).read_text(encoding='utf8')
    if name=='scripts/start-public-web.js':
        lines=text.splitlines(keepends=True);selected=[s for s in lines if '인터넷 합성 시연 · CT 열람/전송' in s]
        assert len(selected)==1 and "if(file.endsWith('.html')" in selected[0]
        return once(text,selected[0],'')
    if name.endswith('patient-health.js'):
        return once(text,"patientName()?`${patientName()}님의 건강기록`:'내 건강기록'","'내 건강기록'").replace('검사부터 건강검진까지, 한곳에서 확인하세요.','영상부터 건강검진까지 한곳에서 확인하세요.')
    if name.endswith('patient-helper.js'):
        text=once(text,"node('p', 'helper-eyebrow', 'Medi Q 건강도우미'), node('h1', '', '내 기록을 알기 쉽게')","node('h1', '', '건강도우미')")
        return once(text,'검사 변화를 확인하고, 다음 진료 질문을 준비해요.','내 기록을 알기 쉽게, 다음 진료를 준비해요.')
    assert name=='public/index.html'
    for page in ['sharing','consent','activity']:
        # End at the next page comment, not a nested section end.
        at=text.index('data-page="'+page+'" hidden>');start=text.rfind('<section',0,at)
        end=text.index('\n          <!--',at)
        original=text[start:end];closing=original.rfind('</section>')
        block=original[:closing]+'  </div>\n          '+original[closing:]
        opening=block.index('>')+1
        block=block[:opening]+'\n            <div class="patient-task-card">'+block[opening:]
        text=once(text,original,block)
    text=once(text,'<h1>내 영상을, 필요한 병원에.</h1><p>공유할 검사와 병원을 선택해 주세요.</p>','<h1>영상 공유</h1><p>공유할 검사와 받을 병원을 선택하세요.</p>')
    text=once(text,'<button class="share-back" type="button" data-route="home">← 홈으로</button>','<button class="share-back" type="button" data-route="home">‹ 내 지갑으로</button>')
    text=once(text,'<h1><span id="share-patient-name">환자</span>님,<br>이 내용으로 공유할까요?</h1>','<h1>공유 승인 전 확인</h1>')
    text=once(text,'<p>받는 병원과 이용 범위를 확인해 주세요.</p>','<p><span id="share-patient-name">환자</span>님의 검사, 받는 병원과 이용 범위를 확인하세요.</p>')
    old='<header class="history-heading"><h1>내 영상이 이어준 진료.</h1><p>내가 허용한 공유와 이용 조건을 확인하세요.</p></header>'
    text=once(text,old,'')
    anchor='<div class="history-layout">'
    text=once(text,anchor,'<button class="health-wallet-back" type="button" data-route="home">‹ 내 지갑으로</button>\n            <header class="history-heading"><h1>공유 내용 확인</h1><p>어떤 병원에 무엇을 언제까지 허용했는지 확인하세요.</p></header>\n            '+anchor)
    return text
def stage():
    folder=support.config.protected_folder();client=support.runtime.connect('CLOUD',None)
    try:
        result=support.runtime.remote(client,'CLOUD',None,"""
import subprocess,json,base64
names=['hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-control-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names]));assert all(i['State']['Running'] for i in items)
paths="""+repr(FILES)+"""
code="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.readFileSync('/app/'+p).toString('base64')]))))"
files=json.loads(subprocess.check_output(['docker','exec',items[0]['Id'],'/nodejs/bin/node','-e',code,json.dumps(paths)]))
print(json.dumps({'baseline':[{'name':i['Name'],'id':i['Id'],'image':i['Image']} for i in items],'files':files}))
""",45)
        (folder/'baseline.json').write_text(json.dumps(result))
        stage='/home/highpassadmin/.highpass-task-ui-'+folder.name
        manifest={'stage':stage,'baseline':result['baseline'],'hashes':{},'review':'DRAFT / UNASSIGNED'}
        with client.open_sftp() as ftp:
            ftp.mkdir(stage,0o700)
            for name,encoded in result['files'].items():
                text=transform(name,base64.b64decode(encoded).decode().replace('\r\n','\n'))
                dest=folder/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text,encoding='utf8',newline='\n')
                for p in reversed(pathlib.PurePosixPath(name).parents):
                    if str(p)=='.':continue
                    try:ftp.mkdir(stage+'/'+str(p),0o755)
                    except OSError:pass
                ftp.put(str(dest),stage+'/'+name);ftp.chmod(stage+'/'+name,0o644)
                manifest['hashes'][name]=hashlib.sha256(dest.read_bytes()).hexdigest()
        (folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
        return {'folder':str(folder),'baseline':result['baseline'][0]}
    finally:client.close()
REMOTE=r'''
import subprocess,json,pathlib,os,time,hashlib
folder=pathlib.Path(M['stage']);assert str(folder).startswith('/home/highpassadmin/.highpass-task-ui-')
def run(args):
 r=subprocess.run(args,capture_output=True,timeout=180)
 if r.returncode:
  p=folder/(PHASE+'-error.log');p.write_bytes(r.stdout+r.stderr);p.chmod(0o600);raise RuntimeError('WEB_COMMAND_FAILED')
 return r.stdout
def inspect(name):return json.loads(run(['docker','inspect',name]))[0]
def save(name,data):
 p=folder/name;p.write_text(json.dumps(data));p.chmod(0o600)
def switch(name):run(['docker','compose','-p','hp-public-web','-f',str(folder/name),'up','-d','--no-deps','--pull','never','web'])
name='hp-public-web-web-1'
if PHASE=='build':
 old=inspect(name);assert old['Image']==M['baseline'][0]['image']
 for file,sha in M['hashes'].items():assert hashlib.sha256((folder/file).read_bytes()).hexdigest()==sha
 base='highpass-task-ui-base:'+old['Image'][7:23];run(['docker','tag',old['Image'],base])
 (folder/'Dockerfile').write_text('FROM '+base+'\nCOPY --chmod=755 public/ /app/public/\nCOPY --chmod=755 scripts/start-public-web.js /app/scripts/start-public-web.js\n')
 tag='highpass-task-ui:'+folder.name.removeprefix('.highpass-task-ui-').lower()
 run(['docker','build','--network=none','--pull=false','-t',tag,str(folder)])
 candidate=inspect(tag);original=inspect(old['Image']);assert candidate['Config']==original['Config']
 assert candidate['RootFS']['Layers'][:-2]==original['RootFS']['Layers']
 for file in M['hashes']:
  if file.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL',candidate['Id'],'--check','/app/'+file])
 print(json.dumps({'image':candidate['Id'],'status':'PASS'}))
elif PHASE in ['deploy','banner']:
 for expected in M['baseline'][1 if PHASE=='banner' else 0:]:
  actual=inspect(expected['name']);assert actual['Id']==expected['id'] and actual['Image']==expected['image'],'BASELINE_CHANGED'
 old=inspect(name);labels=old['Config']['Labels']
 if PHASE=='banner':assert old['Image']==M['candidate']['image']
 cmd=['docker','compose','--project-directory',labels['com.docker.compose.project.working_dir'],'-p','hp-public-web']
 for f in labels['com.docker.compose.project.config_files'].split(','):cmd+=['-f',f]
 config=json.loads(run(cmd+['config','--format','json']))
 assert config['services']['web']['image']==old['Image'],'COMPOSE_IMAGE_CHANGED'
 config['services']['web']['environment']={k:v.replace('$','$$') for k,v in (entry.split('=',1) for entry in old['Config']['Env'])}
 prefix='web-banner' if PHASE=='banner' else 'web'
 save(prefix+'-before.json',config);config['services']['web']['image']=M['candidate']['image']
 mounts=[v for v in config['services']['web'].get('volumes',[]) if v.get('target')=='/app/scripts/start-public-web.js']
 assert len(mounts)==1 and mounts[0]['type']=='bind' and mounts[0]['read_only'],'SCRIPT_BIND_CHANGED'
 old_script=pathlib.Path(mounts[0]['source']);assert old_script.is_file() and '인터넷 합성 시연 · CT 열람/전송' in old_script.read_text(),'SCRIPT_CONTENT_CHANGED'
 candidate_script=folder/'scripts/start-public-web.js';assert hashlib.sha256(candidate_script.read_bytes()).hexdigest()==M['hashes']['scripts/start-public-web.js']
 mounts[0]['source']=str(candidate_script)
 save(prefix+'-after.json',config)
 try:
  switch(prefix+'-after.json');current=inspect(name)
  assert current['State']['Running'] and current['Image']==M['candidate']['image']
  assert dict(e.split('=',1) for e in current['Config']['Env'])==dict(e.split('=',1) for e in old['Config']['Env'])
  for key in ['User','Entrypoint','Cmd']:assert current['Config'][key]==old['Config'][key]
  expected_mounts=json.loads(json.dumps(old['Mounts']))
  for mount in expected_mounts:
   if mount['Destination']=='/app/scripts/start-public-web.js':mount['Source']=str(candidate_script)
  assert current['Mounts']==expected_mounts
  for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:assert current['HostConfig'][key]==old['HostConfig'][key]
  for expected in M['baseline'][1:]:assert inspect(expected['name'])['Id']==expected['id']
 except Exception:
  switch(prefix+'-before.json');raise
 print(json.dumps({'status':'PASS','image':current['Image'],'apiDatabaseWafUnchanged':True,'rollback':str(folder/(prefix+'-before.json'))}))
elif PHASE=='rollback':
 assert inspect(name)['Image']==M['candidate']['image'],'ROLLBACK_TARGET_CHANGED'
 switch('web-before.json');print(json.dumps({'status':'PASS','image':inspect(name)['Image']}))
'''
def operation(folder,phase):
    manifest=json.loads((folder/'manifest.json').read_text());client=support.runtime.connect('CLOUD',None)
    try:result=support.runtime.remote(client,'CLOUD',None,'M='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+REMOTE,300)
    finally:client.close()
    if phase=='build':manifest['candidate']=result;(folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
    (folder/(phase+'.json')).write_text(json.dumps(result,indent=2));return result
def verify(folder):
    manifest=json.loads((folder/'manifest.json').read_text());checks=[]
    for file,digest in manifest['hashes'].items():
        if not file.startswith('public/'):continue
        url=support.ORIGIN+('/hipass/' if file=='public/index.html' else '/'+file.removeprefix('public/'))
        with urllib.request.urlopen(url,timeout=30) as r:data=r.read()
        if file=='public/index.html':
            assert '인터넷 합성 시연 · CT 열람/전송' not in data.decode()
            assert data.decode().count('class="patient-task-card"')==3
            expected=(folder/file).read_text(encoding='utf8').replace('<html lang="ko">','<html lang="ko" data-capstone="1">').encode()
            assert data==expected,'SERVED_HTML_CHANGED'
        else:assert hashlib.sha256(data).hexdigest()==digest,'SERVED_FILE_CHANGED'
        checks.append({'path':file,'status':'PASS'})
    with urllib.request.urlopen(support.ORIGIN+'/mobile/',timeout=30) as r:assert '인터넷 합성 시연 · CT 열람/전송' not in r.read().decode()
    checks.append({'path':'/mobile/ banner removed','status':'PASS'})
    result={'checks':checks,'review':'DRAFT / UNASSIGNED'};(folder/'verify.json').write_text(json.dumps(result,indent=2));return result
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['stage','build','deploy','banner','rollback','verify']);parser.add_argument('--folder',type=pathlib.Path);args=parser.parse_args()
    if args.folder:assert args.folder.resolve().is_relative_to(ROOT/'artifacts/azure')
    print(json.dumps(stage() if args.phase=='stage' else verify(args.folder) if args.phase=='verify' else operation(args.folder,args.phase)),flush=True)
