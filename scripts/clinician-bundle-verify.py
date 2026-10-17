"""Verify candidate bytes and preserved server/auth/mobile trees without networking."""
import argparse,hashlib,importlib.util,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--folder',required=True);p.add_argument('--image',required=True);a=p.parse_args()
folder=(ROOT/a.folder).resolve();assert folder.is_relative_to((ROOT/'artifacts/workstation').resolve())
m=json.loads((folder/'manifest.json').read_text())
spec=importlib.util.spec_from_file_location('clinician_ui',ROOT/'scripts/clinician-ui.py')
manager=importlib.util.module_from_spec(spec);spec.loader.exec_module(manager)
manager.load_bundle(str(folder))
def run(args):return subprocess.check_output(args,cwd=ROOT,timeout=120)
js="const fs=require('fs'),c=require('crypto');let files=JSON.parse(process.argv[1]);function walk(p){if(!fs.existsSync('/app/'+p))return;for(const n of fs.readdirSync('/app/'+p)){const f=p+'/'+n;if(fs.statSync('/app/'+f).isDirectory())walk(f);else files.push(f)}}for(const p of ['src','scripts','public'])walk(p);console.log(JSON.stringify(Object.fromEntries([...new Set(files)].map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/'+f)).digest('hex')]))));"
base=m['base'];image=run(['docker','image','inspect',a.image,'--format','{{.Id}}']).decode().strip()
hashes={}
for label,img in [('base',base),('candidate',image)]:
    files=list(m['hashes'])+['public/capstone-auth.js']
    hashes[label]=json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',img,'-e',js,json.dumps(files)])) if label=='candidate' else json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',img,'-e',js,json.dumps(['public/capstone-auth.js'])]))
assert all(hashes['candidate'][f]==h for f,h in m['hashes'].items()),'CANDIDATE_HASH_MISMATCH'
assert all(hashes['candidate'].get(f)==h for f,h in hashes['base'].items() if f not in m['hashes']),'PROTECTED_FILE_CHANGED'
assert set(hashes['candidate'])==set(hashes['base'])|set(m['hashes']),'UNDECLARED_IMAGE_FILE'
info=json.loads(run(['docker','image','inspect',image]))[0];bi=json.loads(run(['docker','image','inspect',base]))[0]
assert info['RootFS']['Layers'][:-m.get('overlayLayers',len(m['hashes']))]==bi['RootFS']['Layers'],'BASE_CHANGED'
out=dict(status='PASS',scope='CANDIDATE_BYTES_AND_PROTECTED_TREES_ONLY',sourceRevision=m['sourceRevision'],image=image,base=base,files=len(m['hashes']),baseFiles=len(hashes['base']),protectedFiles=sum(f not in m['hashes'] for f in hashes['base']),deployed=False,review='DRAFT / UNASSIGNED')
(folder/'verification.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
