"""Capture immutable deployed image code for an authentication-only candidate."""
import argparse, base64, difflib, hashlib, importlib.util, json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE={'control':'sha256:3d1cb6c2d7dfcaf33d1cefd13b89055ac58e6a5ab349808352862fbe08895436',
      'portal':'sha256:2c09773d13276396ba5d2a6084293aec16809ce17c09b59a263b0cb2603931e0'}
FILES={'control':['src/auth.js','src/oidc-jwks.js','src/server.js','scripts/start-capstone-control.js','src/capstone-patient-runtime-config.js'],
       'portal':['src/capstone-b-portal.js','scripts/start-capstone-b-portal.js','public/capstone-auth.js']}
def run(args,timeout=90):
    return subprocess.check_output(args,cwd=ROOT,timeout=timeout,stderr=subprocess.PIPE)
def main():
    spec=importlib.util.spec_from_file_location('entra_config',ROOT/'scripts/entra-web-config.py')
    config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
    folder=config.protected_folder()
    manifest={'scope':'AUTHENTICATION_ONLY_CAPTURE','review':'DRAFT / UNASSIGNED','deployed':False,'roles':{}}
    for role,base in BASE.items():
        info=json.loads(run(['docker','image','inspect',base]))[0]
        assert info['Id']==base
        js="const fs=require('fs');let o={};for(const f of JSON.parse(process.argv[1])){try{o[f]=fs.readFileSync('/app/'+f).toString('base64')}catch(e){if(e.code!=='ENOENT')throw e;o[f]=null}}console.log(JSON.stringify(o))"
        data=json.loads(run(['docker','run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--entrypoint=/nodejs/bin/node',base,'-e',js,json.dumps(FILES[role])]))
        record={'base':base,'config':info['Config'],'layers':info['RootFS']['Layers'],'hashes':{},'diffLines':{}}
        for name,encoded in data.items():
            if encoded is None: continue
            raw=base64.b64decode(encoded)
            target=folder/role/'baseline'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            record['hashes'][name]=hashlib.sha256(raw).hexdigest()
            local=(ROOT/name).read_text(encoding='utf8')
            diff=''.join(difflib.unified_diff(raw.decode().splitlines(True),local.splitlines(True),fromfile='baseline/'+name,tofile='workspace/'+name))
            target=folder/role/'diff'/ (name+'.diff');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(diff,encoding='utf8')
            record['diffLines'][name]=len(diff.splitlines())
        manifest['roles'][role]=record
    (folder/'capture.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    print(json.dumps({'folder':str(folder),'diffLines':{r:x['diffLines'] for r,x in manifest['roles'].items()}}))
if __name__=='__main__':main()
