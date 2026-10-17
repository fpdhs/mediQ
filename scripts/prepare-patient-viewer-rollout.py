"""Overlay only the patient changes on captured live code; preserve unrelated work."""
import base64,json,pathlib,sys,zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def once(text,old,new):
    assert text.count(old)==1,'EXACT_PATCH_ANCHOR_REQUIRED'
    return text.replace(old,new,1)
def main():
    folder=pathlib.Path(sys.argv[1]).resolve();assert folder.is_relative_to(ROOT/'artifacts/azure')
    allparts={**json.loads((folder/'CLOUD-capture.json').read_text()),**json.loads((folder/'B-capture.json').read_text())}
    output={}
    for part,value in allparts.items():
        files={}
        for name,encoded in value['files'].items():
            old=base64.b64decode(encoded).decode().replace('\r\n','\n');local=(ROOT/name).read_text(encoding='utf8')
            if name=='src/server.js':
                new=once(old,'import { ingressMeta, validateIngressConfig } from "./ingress.js";',
                    'import { ingressMeta, validateIngressConfig } from "./ingress.js";\nimport { patientRequestOrigin } from \'./patient-public-origins.js\';')
                new=once(new,'new URL(request.url, service.publicBaseUrl).href','new URL(request.url, patientRequestOrigin(request.url, process.env, service.publicBaseUrl)).href')
            elif name=='src/capstone-b-portal.js':
                new=once(old,'origin = "https://192.168.111.149:9443", transport','origin = "https://192.168.111.149:9443", patientOrigin=origin, transport')
                line=next(x for x in local.splitlines() if "throw new Error('PATIENT_ORIGIN_INVALID')" in x)
                new=once(new,'  root = path.resolve(root);',line+'\n  root = path.resolve(root);')
                assert new.count('parsePatientDataPlaneRequest({method:request.method,path:raw},origin)')==2
                new=new.replace('parsePatientDataPlaneRequest({method:request.method,path:raw},origin)','parsePatientDataPlaneRequest({method:request.method,path:raw},patientOrigin)')
            elif name=='scripts/start-capstone-b-portal.js':
                new=once(old,'let patientImageDecryption;',"const patientOrigin=process.env.HIPASS_PATIENT_IMAGE_ORIGIN||'https://192.168.111.149:9443';\nlet patientImageDecryption;")
                new=once(new,"control,publicBaseUrl:'https://192.168.111.149:9443'","control,publicBaseUrl:patientOrigin")
                new=once(new,'root: "/app/public", ca, encryptionRequired','root: "/app/public", ca, patientOrigin, encryptionRequired')
            elif name=='public/mobile/sw.js':new=once(old,'hipass-mediq-shell-v45','hipass-mediq-shell-v46')
            else:new=local
            files[name]='z:'+base64.b64encode(zlib.compress(new.encode())).decode()
        if part=='control':
            for name in ['src/patient-public-origins.js','src/patient-entra-ownership-binding.js']:
                files[name]='z:'+base64.b64encode(zlib.compress((ROOT/name).read_bytes())).decode()
        output[part]={'id':value['id'],'image':value['image'],'files':files}
    (folder/'payload.json').write_text(json.dumps(output))
    print(json.dumps({'status':'PREPARED','files':{k:list(v['files']) for k,v in output.items()}}))
if __name__=='__main__':main()
