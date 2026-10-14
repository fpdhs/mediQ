"""Narrow Cloud overlay from live files; no B/PACS or identity configuration changes."""
import base64,hashlib,importlib.util,json,pathlib,sys,zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('runtime',ROOT/'scripts/health-helper-runtime-check.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
FOLDER=ROOT/'artifacts/azure/qr-public-20261013'; REMOTE='/opt/highpass/qr-public-rollout-20261013'
FILES={'control':['src/server.js','src/patient-public-origins.js'],
 'web':['public/app.js','public/ui/patient.js','public/ui/demo-tools.js','public/mobile/sw.js','scripts/start-public-web.js']}
def once(text,old,new):
    assert text.count(old)==1,'ANCHOR_CHANGED';return text.replace(old,new,1)
def function(text,name,end):
    start=text.index(name);return text[start:text.index(end,start)]
def patch(name,old):
    local=(ROOT/name).read_text(encoding='utf8')
    if name=='src/server.js':
        old=once(old,"import { patientRequestOrigin } from './patient-public-origins.js';","import { patientRequestOrigin } from './patient-public-origins.js';\nimport {publicHandoffReceipt,qrInputMeta,isPublicQrPrincipal} from './public-qr-handoff.js';")
        start=old.index('      const result = await service.issueConsentHandoffTicket(');end=old.index('    } catch',start)
        block=old[start:end];old=once(old,block,once(block,'sendJson(response, 201, result);','sendJson(response, 201, publicHandoffReceipt(result,process.env,service.publicBaseUrl));'))
        old=once(old,'if (method === "POST" && url.pathname === "/api/transfers/tickets/redeem-viewer") {','if (method === "POST" && ["/api/transfers/tickets/redeem-viewer","/api/demo/qr/redeem"].includes(url.pathname)) {')
        return once(old,'    const result = await service.redeemViewerHandoff(body.nonce, principal, requestMeta(request, principal));',"    let qrMeta;\n    if(url.pathname==='/api/demo/qr/redeem'&&!isPublicQrPrincipal(principal,process.env))return sendJson(response,403,{error:'QR_DEMO_NOT_ALLOWED'});\n    try { qrMeta=qrInputMeta(body,principal,requestMeta(request, principal),process.env); }\n    catch { return sendJson(response,403,{error:'QR_INPUT_NOT_ALLOWED'}); }\n    const result = await service.redeemViewerHandoff(body.nonce, principal, qrMeta);")
    if name=='public/app.js':
        for start,end in [('async function createPatientConsent(', 'async function revokePatientConsent('),('async function simulateQrScan(', 'function resetQrScan(')]:
            old=once(old,function(old,start,end),function(local,start,end))
        old=once(old,'async function redeemScannedNonce(nonce) {',"async function redeemScannedNonce(nonce, inputMethod='CAMERA') {")
        start=old.index('async function redeemScannedNonce(');end=old.index('async function simulateQrScan(',start)
        block=old[start:end];old=once(old,block,once(block,'{ nonce });','{ nonce, inputMethod });'))
        old=once(old,function(old,'async function redeemScannedNonce(', 'async function simulateQrScan('),function(local,'async function redeemScannedNonce(', 'async function simulateQrScan('))
        old=once(old,'"/api/transfers/tickets/redeem"].includes(url.pathname)','"/api/transfers/tickets/redeem", "/api/demo/qr/redeem"].includes(url.pathname)')
        old=once(old,'if (path === "/api/transfers/tickets/redeem-viewer") {','if (path === "/api/transfers/tickets/redeem-viewer" || path === "/api/demo/qr/redeem") {')
        old=once(old,'    await redeemScannedNonce(nonce);',"    await redeemScannedNonce(nonce, input.dataset.demoImport==='1'?'DEMO_IMPORT':'MANUAL');\n    delete input.dataset.demoImport;")
        for line in ['      // Never redeem a cached ticket belonging to a different selection.\n','      latestConsentId=getConsentForStudy(selectedStudyUid,lastConsents)?.consentId;\n','      latestTicketNonce=null;\n']:
            at=old.index("    if(id==='simulate'){");end=old.index("    if(currentPersona",at)
            block=old[at:end];old=once(old,block,once(block,line,''))
        return old
    if name=='public/mobile/sw.js':return once(old,'hipass-mediq-shell-v46','hipass-mediq-shell-v47')
    if name=='scripts/start-public-web.js':
        routes=function(local,'const routes=['," ['GET',/^\\/api\\/capstone-demo")
        return once(old,'const routes=[\n',routes)
    if name=='public/ui/patient.js':
        return once(old,function(old,'export function renderPatientQr(', '\n}',)+ '\n}',function(local,'export function renderPatientQr(', '\n}')+'\n}')
    if name=='public/ui/demo-tools.js':
        # This module's only changes in this release are input-only QR menu policy.
        for start,end in [('export function demoToolsModel(', 'export function initializeDemoTools(')]:old=once(old,function(old,start,end),function(local,start,end))
        return old
    assert name=='src/patient-public-origins.js';return local
def main():
    phase=sys.argv[1];FOLDER.mkdir(parents=True,exist_ok=True)
    source=(ROOT/'scripts/patient-viewer-rollout-remote.py').read_text().replace('/opt/highpass/patient-viewer-rollout-20261013',REMOTE)
    client=runtime.connect('CLOUD',None)
    try:
        if phase=='capture':
            result=runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD","capture",'+repr(FILES)+')))',55)
            (FOLDER/'baseline.json').write_text(json.dumps(result));payload={}
            for part,info in result.items():
                files={}
                for name,value in info['files'].items():
                    old=base64.b64decode(value).decode().replace('\r\n','\n');new=patch(name,old)
                    target=FOLDER/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(new,encoding='utf8',newline='\n')
                    files[name]='z:'+base64.b64encode(zlib.compress(new.encode())).decode()
                if part=='control':files['src/public-qr-handoff.js']='z:'+base64.b64encode(zlib.compress((ROOT/'src/public-qr-handoff.js').read_bytes())).decode()
                payload[part]={'id':info['id'],'image':info['image'],'files':files}
            (FOLDER/'payload.json').write_text(json.dumps(payload));result={'status':'CAPTURED_AND_PATCHED','files':FILES}
        else:
            payload={}
            if phase=='stage':
                with client.open_sftp() as ftp:
                    ftp.put(str(FOLDER/'payload.json'),'/home/highpassadmin/.qr-public-payload.json');ftp.chmod('/home/highpassadmin/.qr-public-payload.json',0o600)
                load="json.loads(pathlib.Path('/home/highpassadmin/.qr-public-payload.json').read_text())"
            else:load='{}'
            result=runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD",'+repr(phase)+','+load+')))',55)
        (FOLDER/(phase+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result))
    finally:client.close()
if __name__=='__main__':main()
