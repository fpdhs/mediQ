"""Publish a pinned UI asset overlay to the existing web; preserve Control."""
import argparse,hashlib,importlib.util,json,pathlib,subprocess,shlex,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','scripts/health-helper-runtime-check.py');cfg=load('config','scripts/entra-web-config.py')
if sys.argv[1:]==['--inspect']:
 c=r.connect('CLOUD',None)
 try: print(json.dumps(r.remote(c,'CLOUD',None,"import subprocess,json; info=json.loads(subprocess.check_output(['docker','inspect','hp-public-web-web-1']))[0]; print(json.dumps({'image':info['Image']}))",30)))
 finally:c.close()
 sys.exit(0)
parser=argparse.ArgumentParser();parser.add_argument('--base',required=True);parser.add_argument('--assets',nargs='+');args=parser.parse_args()
folder=cfg.protected_folder();base=args.base
if not __import__('re').fullmatch(r'sha256:[0-9a-f]{64}',base):raise ValueError('PINNED_IMAGE_REQUIRED')
names=['public/capstone-auth.js','public/entra-auth.js','public/ui/demo-entry.js','public/login-navigation.js','public/mobile/sw.js','public/mobile/app.js','public/auth-boot.css']
if args.assets:
 allowed={'public/ui/mobile.css','public/ui/capstone-login.css','public/ui/demo-entry.css','public/ui/patient-visit-pass.css','public/capstone-auth.js','public/mobile/sw.js'}
 if not set(args.assets)<=allowed:raise ValueError('UNAPPROVED_UI_ASSET')
 names=list(dict.fromkeys(args.assets))
hashes={}
for name in names:
 data=(ROOT/name).read_bytes();dest=folder/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);hashes[name]=hashlib.sha256(data).hexdigest()
# Preserve deployed HTML exactly, adding only the pre-module rendering guard.
htmls=json.loads(subprocess.check_output(['docker','run','--rm','--network=none',base,'-e',"const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(['public/index.html','public/mobile/index.html'].map(p=>[p,fs.readFileSync('/app/'+p,'utf8')]))))"],timeout=60))
for name,html in htmls.items():
 assert html.count('<head>')==1
 if 'href="/auth-boot.css"' in html:
  hashes[name]=hashlib.sha256(html.encode()).hexdigest()
  continue
 data=html.replace('<head>','<head>\n  <link rel="stylesheet" href="/auth-boot.css">',1).encode()
 dest=folder/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);hashes[name]=hashlib.sha256(data).hexdigest();names.append(name)
subprocess.run(['docker','tag',base,'highpass-public-login-base:20261013'],check=True,timeout=20)
(folder/'Dockerfile').write_text('FROM highpass-public-login-base:20261013\n'+''.join('COPY '+n+' /app/'+n+'\n' for n in names))
tag='highpass-public-login:'+folder.name.lower();p=subprocess.run(['docker','build','--network=none','--pull=false','-t',tag,str(folder)],capture_output=True,timeout=180)
(folder/'build.log').write_bytes(p.stdout+p.stderr);assert p.returncode==0
image=json.loads(subprocess.check_output(['docker','inspect',tag],timeout=15))[0]['Id']
archive=folder/'image.tar';subprocess.run(['docker','save','-o',str(archive),image],check=True,timeout=120)
with archive.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
print(json.dumps({'phase':'UPLOAD','receipt':str(folder),'image':image}),flush=True)
c=r.connect('CLOUD',None);stage='/home/highpassadmin/.highpass-login-'+folder.name
try:
 with c.open_sftp() as ftp:
  ftp.get_channel().settimeout(30);ftp.mkdir(stage,0o700);ftp.put(str(archive),stage+'/image.tar')
 program='''import subprocess,json,pathlib,hashlib,os
folder=pathlib.Path(STAGE)
def run(a,t=90):return subprocess.check_output(a,stderr=subprocess.PIPE,timeout=t)
def inspect(n):return json.loads(run(['docker','inspect',n]))[0]
old=inspect('hp-public-web-web-1');control=inspect('hp-capstone-control-control-1')['Id'];assert old['Image']==BASE
with (folder/'image.tar').open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==DIGEST
run(['docker','load','-i',str(folder/'image.tar')],120)
labels=old['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
cmd=['docker','compose','-p','hp-public-web']
for f in files:cmd+=['-f',f]
config=json.loads(run(cmd+['config','--format','json']))
(folder/'before.json').write_text(json.dumps(config));os.chmod(folder/'before.json',0o600)
config['services']['web']['image']=IMAGE
(folder/'compose.json').write_text(json.dumps(config));os.chmod(folder/'compose.json',0o600)
new=['docker','compose','-p','hp-public-web','-f',str(folder/'compose.json')]
try:
 run(new+['up','-d','--no-deps','--pull','never','web'],90)
 assert inspect('hp-public-web-web-1')['Image']==IMAGE
 assert inspect('hp-capstone-control-control-1')['Id']==control
except Exception:
 run(['docker','compose','-p','hp-public-web','-f',str(folder/'before.json'),'up','-d','--no-deps','--pull','never','web'],90);raise
print(json.dumps({'image':IMAGE,'controlUnchanged':True,'rollback':str(folder/'before.json')}))
'''
 for k,v in {'STAGE':stage,'BASE':base,'IMAGE':image,'DIGEST':digest}.items():program=program.replace(k,repr(v))
 result=r.remote(c,'CLOUD',None,program,300)
 result.update({'hashes':hashes,'review':'DRAFT / UNASSIGNED','receipt':str(folder)})
 (folder/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
finally:c.close()
