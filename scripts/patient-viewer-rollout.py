"""Masked B operator session; reviewed, fixed deployment phases; credentials RAM only."""
import base64, importlib.util, json, pathlib, queue, sys, threading, time
from datetime import datetime, timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
FILES={'control':['src/auth.js','src/server.js','src/patient-self-view-authority.js','src/patient-self-view-authorization.js',
 'src/patient-self-view-grant-repository.js','src/patient-self-view-audit-adapter.js','src/patient-self-view-grant-runtime.js'],
 'web':['scripts/start-public-web.js','public/patient-pixel-viewer.js','public/mobile/sw.js'],
 'portal':['src/capstone-b-portal.js','scripts/start-capstone-b-portal.js']}

def main():
    spec=importlib.util.spec_from_file_location('rollout_auth',ROOT/'scripts/deployment-auth-preflight.py')
    auth=importlib.util.module_from_spec(spec);spec.loader.exec_module(auth)
    password=auth.ask_password_gui()
    if not password:return 2
    clients={};folder=ROOT/'artifacts/azure'/('patient-viewer-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True)
    try:
        for role in ['B','CLOUD']:clients[role]=auth.runtime.connect(role,password if role=='B' else None)
        print(json.dumps({'status':'READY','folder':str(folder)}),flush=True)
        inbox=queue.Queue()
        def reader():
            for line in sys.stdin:inbox.put(line.strip())
            inbox.put('close')
        threading.Thread(target=reader,daemon=True).start();deadline=time.monotonic()+3600;number=0
        while time.monotonic()<deadline:
            try:command=inbox.get(timeout=30)
            except queue.Empty:continue
            if command=='close':break
            role,_,phase=command.partition(':')
            if role not in clients or phase not in ['capture','stage','migrate','deploy','rollback','verify','tls-stage','tls-open','tls-close','probe']:
                print('{"status":"REJECTED"}',flush=True);continue
            try:
                payload=FILES if phase=='capture' else json.loads((folder/'payload.json').read_text()) if phase=='stage' else {}
                if phase=='migrate':payload={'migration':base64.b64encode((ROOT/'db/migrations/038_patient_entra_grant_actor.sql').read_bytes()).decode()}
                source=(ROOT/'scripts/patient-viewer-rollout-remote.py').read_text()
                result=auth.runtime.remote(clients[role],role,password,source+'\nprint(json.dumps(main('+repr(role)+','+repr(phase)+','+repr(payload)+')))',55)
                number+=1;(folder/(str(number).zfill(3)+'-'+role+'-'+phase+'.json')).write_text(json.dumps(result,indent=2))
                (folder/(role+'-'+phase+'.json')).write_text(json.dumps(result))
                print(json.dumps({'role':role,'phase':phase,'status':'PASS','result':{'captured':True} if phase=='capture' else result}),flush=True)
            except Exception as e:print(json.dumps({'role':role,'phase':phase,'status':'FAIL','type':type(e).__name__,'reason':str(e) if str(e).startswith('REMOTE_FAILED_') else 'SCOPED_PHASE_FAILED'}),flush=True)
    finally:
        for client in clients.values():client.close()
        password=None
    return 0
if __name__=='__main__':raise SystemExit(main())
