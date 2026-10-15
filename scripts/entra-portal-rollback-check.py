"""Rehearse portal static-auth/CSP recovery using immutable images, with no published ports."""
import argparse, json, pathlib, subprocess, time, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROBE="""
import http from 'node:http';import {createHash} from 'node:crypto';
import {createCapstoneBPortal} from '/app/src/capstone-b-portal.js';
const enabled=process.env.PROBE_ENTRA==='1';
const server=http.createServer(createCapstoneBPortal({root:'/app/public',ca:Buffer.from('unused-static-only'),entraLoginEnabled:enabled,
transport:()=>{throw new Error('NO_UPSTREAM_ALLOWED')}}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));let output={};
try{for(const path of ['/capstone-auth.js','/entra-redirect.html']){
 const r=await fetch('http://127.0.0.1:'+server.address().port+path,{signal:AbortSignal.timeout(5000)});
 output[path]={status:r.status,sha256:createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),csp:r.headers.get('content-security-policy')};
}console.log(JSON.stringify(output));}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
"""
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('candidate');args=p.parse_args()
    folder=(ROOT/args.candidate).resolve();assert folder.is_relative_to((ROOT/'artifacts/azure').resolve())
    item=json.loads((folder/'candidate.json').read_text())['roles']['portal']
    folder=folder/('portal-recovery-'+uuid.uuid4().hex[:8]);folder.mkdir();checks=[];snapshots={}
    for phase,image,enabled in [('baseline',item['base'],'0'),('candidate',item['image'],'1'),('restored',item['base'],'0')]:
        name='hp-'+folder.name+'-'+phase;start=time.monotonic()
        try:
            r=subprocess.run(['docker','run','--rm','--name',name,'--label','highpass.portal-recovery='+folder.name,
                '--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true',
                '-e','PROBE_ENTRA='+enabled,'--entrypoint=/nodejs/bin/node',image,'--input-type=module','-e',PROBE],capture_output=True,timeout=90)
            (folder/(phase+'.log')).write_bytes(r.stdout+r.stderr)
            checks.append(dict(test=phase,status='PASS' if r.returncode==0 else 'FAIL',exitCode=r.returncode,seconds=round(time.monotonic()-start,3)))
            if r.returncode:break
            snapshots[phase]=json.loads(r.stdout)
        except Exception as e:checks.append(dict(test=phase,status='FAIL',reason=type(e).__name__));break
        finally:
            state=subprocess.run(['docker','inspect',name],capture_output=True,timeout=15)
            if state.returncode==0:
                assert json.loads(state.stdout)[0]['Config']['Labels']['highpass.portal-recovery']==folder.name
                cleanup=subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=30)
                checks.append(dict(test=phase+'-cleanup',status='PASS' if cleanup.returncode==0 else 'FAIL'))
    if len(snapshots)==3:
        ok=snapshots['baseline']==snapshots['restored']
        ok &= snapshots['candidate']['/entra-redirect.html']['status']==200
        ok &= "connect-src 'self' https://login.microsoftonline.com;" in snapshots['candidate']['/entra-redirect.html']['csp']
        checks.append(dict(test='static-auth-and-CSP-restored-exactly',status='PASS' if ok else 'FAIL'))
    result=dict(status='PASS' if len(snapshots)==3 and all(c['status']=='PASS' for c in checks) else 'FAIL',checks=checks,
        snapshots=snapshots,images=item,scope='ISOLATED_PORTAL_STATIC_HTTP_NOT_LIVE_TLS',review='DRAFT / UNASSIGNED',liveServicesChanged=False)
    out=folder/'rollback.json';out.write_text(json.dumps(result,indent=2));print(json.dumps(dict(status=result['status'],checks=checks,evidence=str(out))))
    return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
