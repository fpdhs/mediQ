"""Reviewed QR-ticket overlay on current Azure containers; preserve all other live files."""
import base64,importlib.util,json,pathlib,sys,zlib,difflib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('previous',ROOT/'scripts/qr-public-release.py');previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
FOLDER=ROOT/'artifacts/azure/qr-ticket-20261013';REMOTE='/opt/highpass/qr-ticket-rollout-20261013'
FILES={'control':['src/server.js','src/services.js'],'web':['public/app.js','public/index.html','public/ui/wallet-home.js','public/mobile/app.js','public/mobile/index.html','public/mobile/sw.js','scripts/start-public-web.js']}
NEW=['public/ui/patient-qr-ticket.js','public/ui/patient-qr-ticket.css']
def patch(name,old):
 local=(ROOT/name).read_text(encoding='utf8');once=previous.once
 if name=='scripts/start-public-web.js':return old
 if name=='src/services.js':
  a='  async issueConsentHandoffTicket(';b='  async redeemViewerHandoff('
  return once(old,previous.function(old,a,b),previous.function(local,a,b))
 if name=='src/server.js':
  a='  if (method === "POST" && segments[1] === "consents" && segments[2] && segments[3] === "handoff-ticket") {';b='  if (method === "GET" && segments[1] === "patients" && segments[2] && segments[3] === "transfer-requests") {'
  return once(old,previous.function(old,a,b),previous.function(local,a,b))
 if name in ['public/index.html','public/mobile/index.html']:
  anchor='<link rel="stylesheet" href="/ui/'+('patient-visit-pass.css' if name=='public/index.html' else 'wallet-home.css')+'">'
  return once(old,anchor,anchor+'\n  <link rel="stylesheet" href="/ui/patient-qr-ticket.css">')
 if name=='public/mobile/sw.js':return once(old,'hipass-mediq-shell-v47','hipass-mediq-shell-v48')
 if name=='public/ui/wallet-home.js':
  for a,b in [("export function mountPatientWalletDock(","export function createWalletHome(")]:old=once(old,previous.function(old,a,b),previous.function(local,a,b))
  old=once(old,"['requests','공유 내용 확인','내가 허용한 공유를 확인해요']","['requests','공유 QR','병원에 보여줄 나의 티켓']")
  old=once(old,"node('span','mq-card-cta','확인하기')","node('span','mq-card-cta','QR 보기')")
  old=once(old,"ready?'내가 허용한 공유를 확인해요'","ready?'병원에 보여줄 나의 티켓'")
  line=next(l for l in local.splitlines() if "if(type==='requests')" in l)
  return once(old,"  const path=document.createElementNS(svg.namespaceURI,'path');","  const path=document.createElementNS(svg.namespaceURI,'path');\n"+line)
 if name=='public/app.js':
  old=once(old,"import {createWalletHome,createHelperSurface,mountPatientWalletDock} from '/ui/wallet-home.js';","import {createWalletHome,createHelperSurface,mountPatientWalletDock} from '/ui/wallet-home.js';\nimport {createQrTicketSurface} from '/ui/patient-qr-ticket.js';")
  a='const patientQrController = ';b='window.addEventListener("pagehide", () => patientQrController.clear());'
  old=once(old,previous.function(old,a,b),previous.function(local,a,b))
  old=once(old,'function navigatePatientPage(page) {',"function navigatePatientPage(page) {\n  if(page==='visit')patientQrController.refresh();")
  old=once(old,'visit: "병원 방문 모드"','visit: "공유 QR"')
  assert old.count("requests:'activity'")==3
  old=old.replace("requests:'activity'","requests:'visit'")
  return once(old,'    latestConsentId = result.consentId;\n    patientConsentReady = true;',"    latestConsentId = result.consentId;\n    lastConsents=[result,...lastConsents.filter(c=>c.consentId!==result.consentId)];\n    patientConsentReady = true;")
 if name=='public/mobile/app.js':
  old=once(old,"import {createWalletHome,createHelperSurface} from '/ui/wallet-home.js';","import {createWalletHome,createHelperSurface} from '/ui/wallet-home.js';\nimport {createQrTicketSurface} from '/ui/patient-qr-ticket.js';\nlet mobileQrTicket=null;")
  start=local.index('  const qrPane=');end=local.index('  createSharingSurface(',start)
  old=once(old,'  setupAuth();\n','  setupAuth();\n'+local[start:end])
  old=once(old,"switchTab(({requests:'share',history:'share',sharing:'share'})[route]||route);","switchTab(({requests:'ticket',history:'share',sharing:'share'})[route]||route);")
  old=once(old,"if(['requests','history'].includes(route))","if(route==='history')")
  line=next(l for l in old.splitlines() if l.startswith('  createHelperSurface('));new=next(l for l in local.splitlines() if l.startswith('  createHelperSurface('));old=once(old,line,new)
  line=next(l for l in old.splitlines() if l.startswith('  createSharingSurface('));new=next(l for l in local.splitlines() if l.startswith('  createSharingSurface('));old=once(old,line,new)
  old=once(old,'async function handleLockApp() {\n  if (!state.isAuthenticated) return;','async function handleLockApp() {\n  if (!state.isAuthenticated) return;\n  mobileQrTicket?.clear();')
  old=once(old,'function handlePatientSelect(patientId) {','function handlePatientSelect(patientId) {\n  mobileQrTicket?.clear();')
  old=once(old,'function switchTab(tabName) {',"function switchTab(tabName) {\n  if(!state.isAuthenticated)mobileQrTicket?.clear();\n  if(tabName==='ticket'){if(!state.isAuthenticated)return;mobileQrTicket?.refresh();}")
  return once(old,'    state.activeTicket = ticketData;','    state.activeTicket = ticketData;\n    mobileQrTicket?.set(ticketData,consent.consentId);')
 raise ValueError(name)
def main():
 phase=sys.argv[1];FOLDER.mkdir(parents=True,exist_ok=True)
 source=(ROOT/'scripts/patient-viewer-rollout-remote.py').read_text().replace('/opt/highpass/patient-viewer-rollout-20261013',REMOTE)
 client=previous.runtime.connect('CLOUD',None)
 try:
  if phase=='capture':
   result=previous.runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD","capture",'+repr(FILES)+')))',55)
   payload={};diff=[]
   for part,info in result.items():
    files={}
    for name,value in info['files'].items():
     old=base64.b64decode(value).decode().replace('\r\n','\n');new=patch(name,old)
     diff.extend(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile=name,tofile=name))
     target=FOLDER/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(new,encoding='utf8',newline='\n');files[name]='z:'+base64.b64encode(zlib.compress(new.encode())).decode()
    if part=='web':
     for name in NEW:
      data=(ROOT/name).read_bytes();files[name]='z:'+base64.b64encode(zlib.compress(data)).decode();target=FOLDER/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    payload[part]={'id':info['id'],'image':info['image'],'files':files}
   (FOLDER/'payload.json').write_text(json.dumps(payload));(FOLDER/'review.diff').write_text(''.join(diff),encoding='utf8');result={'status':'CAPTURED','files':FILES,'new':NEW}
  else:
   load='{}'
   if phase=='stage':
    with client.open_sftp() as ftp:ftp.put(str(FOLDER/'payload.json'),'/home/highpassadmin/.qr-ticket-payload.json');ftp.chmod('/home/highpassadmin/.qr-ticket-payload.json',0o600)
    load="json.loads(pathlib.Path('/home/highpassadmin/.qr-ticket-payload.json').read_text())"
   result=previous.runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD",'+repr(phase)+','+load+')))',55)
  (FOLDER/(phase+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result))
 finally:client.close()
if __name__=='__main__':main()
