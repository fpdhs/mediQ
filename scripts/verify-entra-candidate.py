"""Verify captured auth candidates: exact files, container tests, image scan/SBOM."""
import argparse,hashlib,json,pathlib,subprocess,time,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
SCANNER='aquasec/trivy:0.58.2@sha256:665030f4d33a82c1e8d9d5e0453365842236723c1ee5cc3becca698268e66a56'
TREE="const fs=require('fs'),c=require('crypto'),p=require('path'),o={};function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())walk(f);else if(e.isFile())o[f]=c.createHash('sha256').update(fs.readFileSync(f)).digest('hex');else if(e.isSymbolicLink())o[f]='link:'+fs.readlinkSync(f)}}walk('/app');console.log(JSON.stringify(o))"
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('folder');parser.add_argument('--scan',action='store_true');args=parser.parse_args()
    folder=(ROOT/args.folder).resolve();assert folder.is_relative_to((ROOT/'artifacts/azure').resolve())
    manifest=json.loads((folder/'candidate.json').read_text());checks=[]
    folder=folder/(('scan-' if args.scan else 'verify-')+uuid.uuid4().hex[:8]);folder.mkdir(exist_ok=False)
    def command(label,argv,timeout=120):
        started=time.monotonic();r=subprocess.run(argv,cwd=ROOT,capture_output=True,timeout=timeout)
        (folder/(label+'.log')).write_bytes(r.stdout+r.stderr)
        checks.append(dict(test=label,status='PASS' if r.returncode==0 else 'FAIL',exitCode=r.returncode,seconds=round(time.monotonic()-started,3)))
        return r
    try:
        for role,item in manifest['roles'].items():
            if args.scan:
                name=role+'-trivy.json'
                r=command(role+'-scan',['docker','run','--rm','-v','/var/run/docker.sock:/var/run/docker.sock','-v',str(folder)+':/output','-v','hipass-trivy-cache:/root/.cache/trivy',SCANNER,'image','--quiet','--scanners','vuln','--list-all-pkgs','--severity','HIGH,CRITICAL','--format','json','--output','/output/'+name,item['image']],300)
                if r.returncode:continue
                scan=json.loads((folder/name).read_text());vulns=[v for result in scan.get('Results',[]) for v in result.get('Vulnerabilities',[])]
                # Trivy may report the image config ID while docker uses an OCI index ID.
                info=json.loads(command(role+'-inspect',['docker','image','inspect',item['image']]).stdout)[0]
                bound=scan['Metadata']['ImageID'] in [item['image'],info['Id']]
                checks.append(dict(test=role+'-vulnerability-gate',status='PASS' if bound and not vulns else 'FAIL',highCritical=len(vulns),imageBound=bound))
                packages={}
                for result in scan.get('Results',[]):
                    for p in result.get('Packages',[]):
                        key=p.get('ID',p['Name']+'@'+p['Version']);packages[key]={'type':'library','name':p['Name'],'version':p['Version']}
                        if p.get('Identifier',{}).get('PURL'):packages[key]['purl']=p['Identifier']['PURL']
                sbom={'bomFormat':'CycloneDX','specVersion':'1.5','version':1,'metadata':{'component':{'type':'container','name':role,'version':item['image']}},'components':list(packages.values())}
                (folder/(role+'-sbom.cdx.json')).write_text(json.dumps(sbom,indent=2))
                checks.append(dict(test=role+'-sbom',status='PASS' if packages else 'FAIL',packages=len(packages)))
                continue
            trees=[]
            for label,image in [('base',item['base']),('candidate',item['image'])]:
                r=command(role+'-'+label+'-tree',['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',image,'-e',TREE])
                if r.returncode:raise RuntimeError('IMAGE_TREE_FAILED')
                trees.append(json.loads(r.stdout))
            changed=sorted(k for k in set(trees[0])|set(trees[1]) if trees[0].get(k)!=trees[1].get(k))
            expected=sorted('/app/'+p for p,h in item['hashes'].items() if trees[0].get('/app/'+p)!=h)
            checks.append(dict(test=role+'-auth-files-only',status='PASS' if changed==expected else 'FAIL',changedFiles=changed))
            tests=['test/entra-oidc-auth.test.js','test/entra-metadata.test.js','test/hipass-service.test.js','test/privacy-service-identity.test.js'] if role=='control' else ['test/entra-browser-auth.test.js','test/capstone-b-portal.test.js']
            command(role+'-tests',['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--tmpfs','/tmp:rw,nosuid,nodev,size=64m','--mount','type=bind,source='+str(ROOT/'test')+',target=/app/test,readonly','--entrypoint=/nodejs/bin/node',item['image'],'--test','--test-concurrency=1',*tests],180)
    except Exception as error:checks.append(dict(test='verification',status='FAIL',reason=type(error).__name__))
    result=dict(status='PASS' if checks and all(c['status']=='PASS' for c in checks) else 'FAIL',review='DRAFT / UNASSIGNED',scope='ISOLATED_AUTH_CANDIDATE',images={r:v['image'] for r,v in manifest['roles'].items()},checks=checks)
    out=folder/('scan-result.json' if args.scan else 'verification.json');out.write_text(json.dumps(result,indent=2))
    print(json.dumps(dict(status=result['status'],checks=checks,evidence=str(out))))
    return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
