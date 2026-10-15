"""Narrow web-only overlay; existing QR server authorization stays unchanged."""
import importlib.util,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/qr-ticket-release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
release.FOLDER=ROOT/'artifacts/azure/clinician-reception-20261013'
release.REMOTE='/opt/highpass/clinician-reception-20261013'
release.FILES={'web':['public/app.js','public/index.html','scripts/start-public-web.js']}
release.NEW=['public/ui/clinician-reception.js','public/ui/clinician-reception.css']
def patch(name,old):
 once=release.previous.once
 if name=='scripts/start-public-web.js':return old
 local=(ROOT/name).read_text(encoding='utf8')
 if name=='public/index.html':
  for a,b in [('<link rel="stylesheet" href="/ui/clinician-home.css">','<link rel="stylesheet" href="/ui/clinician-home.css">\n  <link rel="stylesheet" href="/ui/clinician-reception.css">'),('>진료 홈</button>','>홈</button>'),('<section class="mq-screen clinician-home" id="clinical-home" data-screen="dashboard">','<section class="mq-screen clinician-home" id="clinical-home" data-screen="qr" hidden>'),('<section class="mq-screen share-reception" data-screen="qr" hidden>','<section class="mq-screen share-reception" data-screen="dashboard">')]:old=once(old,a,b)
  line=next(l for l in old.splitlines(True) if 'class="mq-nav"' in l and 'data-view="qr"' in l);old=once(old,line,'')
  anchor=next(l for l in old.splitlines(True) if 'class="mq-nav active"' in l and 'data-view="dashboard"' in l)
  return once(old,anchor,anchor+line.replace('공유 접수','접수 데스크'))
 if name=='public/app.js':
  for a,b in [("import { createClinicianHome } from '/ui/clinician-home.js';","import { createClinicianHome } from '/ui/clinician-home.js';\nimport { initializeReceptionHome } from '/ui/clinician-reception.js';"),("if (screen !== 'qr') stopCameraQrScan();","if (screen !== 'dashboard') stopCameraQrScan();"),('dashboard: ["의료진 / 진료 데스크", "진료 홈"]','dashboard: ["의료진 / 홈", "홈"]'),('qr: ["의료진 / 공유 접수", "공유 접수"]','qr: ["의료진 / 접수 데스크", "접수 데스크"]'),('initializePatientComponents();',"initializePatientComponents();\ninitializeReceptionHome(document.querySelector('.share-reception'),()=>currentPersona==='DOCTOR');")]:old=once(old,a,b)
  for a,b in [('async function redeemScannedNonce(', 'async function simulateQrScan()'),('async function simulateQrScan()', 'function resetQrScan()')]:old=once(old,release.previous.function(old,a,b),release.previous.function(local,a,b))
  return old
 raise ValueError(name)
release.patch=patch
original=release.previous.runtime.remote
def remote(client,role,password,source,timeout):
 source=source.replace("roles=['control','web'] if role=='CLOUD' else ['portal']","roles=['web'] if role=='CLOUD' else ['portal']")
 return original(client,role,password,source,timeout)
release.previous.runtime.remote=remote
if __name__=='__main__':release.main()
