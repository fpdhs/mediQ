"""Reviewed receptionist flow overlay; adds a read-only actor-scoped receipt projection."""
import importlib.util,pathlib,sys,base64
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/qr-ticket-release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
release.FOLDER=ROOT/'artifacts/azure/clinician-flow-20261014';release.REMOTE='/opt/highpass/clinician-flow-20261014'
release.FILES={'control':['src/server.js'],'web':['public/app.js','public/index.html','public/ui/clinician-reception.js','public/ui/clinician-reception.css','scripts/start-public-web.js']}
release.NEW=['public/ui/clinician-reception-desk.js']
def patch(name,old):
 local=(ROOT/name).read_text(encoding='utf8');once=release.previous.once;fn=release.previous.function
 if name in ['src/clinician-receptions.js','public/ui/clinician-reception.js','public/ui/clinician-reception.css']:return local
 if name=='src/server.js':
  old=once(old,"import {publicHandoffReceipt,qrInputMeta,isPublicQrPrincipal} from './public-qr-handoff.js';","import {publicHandoffReceipt,qrInputMeta,isPublicQrPrincipal} from './public-qr-handoff.js';\nimport {clinicianReceptions} from './clinician-receptions.js';")
  a="  if (method === 'GET' && url.pathname === '/api/clinician/receptions') {";b='  if (method === "POST" && ["/api/transfers/tickets/redeem-viewer"'
  return once(old,b,local[local.index(a):local.index(b)]+b)
 if name=='scripts/start-public-web.js':return once(old,'const routes=[',"const routes=[\n ['GET',/^\\/api\\/clinician\\/receptions$/],")
 if name=='public/index.html':
  a='          <nav class="clinical-flow"';b='          <!-- Clinical home:'
  old=once(old,fn(old,a,b),fn(local,a,b))
  return once(old,'data-view-jump="qr">QR로 환자 연결','data-view-jump="qr">다른 접수 선택')
 if name=='public/app.js':
  old=once(old,"import { initializeReceptionHome } from '/ui/clinician-reception.js';","import { initializeReceptionHome } from '/ui/clinician-reception.js';\nimport {createReceptionDesk} from '/ui/clinician-reception-desk.js';\nlet receptionDesk=null;")
  pairs=[('function initNavigation() {','function switchPersona('),('function switchPersona(','function navigatePatientPage('),('function navigateHospitalScreen(','// Backwards-compatible View activation helper'),('async function redeemScannedNonce(','async function simulateQrScan()')]
  # Replace only exact changed lines in navigation/persona; avoid importing unrelated dirty blocks.
  for a,b in [('button.dataset.view));',"button.dataset.view==='viewer'?'studies':button.dataset.view));"),("screen === 'studies' ? 'dashboard' : screen","screen === 'studies' ? 'viewer' : screen"),("if (next.action==='qr') { navigateHospitalScreen('qr'); return; }","if (next.action==='qr') { navigateHospitalScreen('dashboard'); return; }"),('path === "/api/demo/qr/redeem") {','path === "/api/demo/qr/redeem" || path === \'/api/clinician/receptions\') {')]:old=once(old,a,b)
  line="  clinicianHome?.reset();";start=local.index(line);end=local.index('  walletHome?.reset();',start);old=once(old,line+'\n',local[start:end])
  line="  clinicianHealth?.setActive(screen==='records'&&currentPersona==='DOCTOR');";old=once(old,line,line+"\n  if(screen==='qr'&&currentPersona==='DOCTOR')receptionDesk?.load();")
  a='async function redeemScannedNonce(';b='async function simulateQrScan()';old=once(old,fn(old,a,b),fn(local,a,b))
  a="receptionDesk=createReceptionDesk(";start=local.index(a);end=local.index('\n});',start)+4
  anchor="  onSelect:uid=>selectStudy(uid), onOpen:openClinicianHomeViewer, onRefresh:()=>loadDashboard()\n});"
  return once(old,anchor,anchor+'\n'+local[start:end])
 raise ValueError(name)
release.patch=patch
original=release.previous.runtime.remote
def remote(client,role,password,source,timeout):
 result=original(client,role,password,source,timeout)
 if 'main("CLOUD","capture",' in source:
  result['control']['files']['src/clinician-receptions.js']=''
 return result
release.previous.runtime.remote=remote
if __name__=='__main__':release.main()
