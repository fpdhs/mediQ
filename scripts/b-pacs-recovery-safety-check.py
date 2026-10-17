"""Offline focused checks with immutable per-run command/hash evidence."""
import hashlib
import json
import pathlib
import subprocess
import sys
import time
from datetime import datetime,timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]

def main():
    folder=ROOT/'artifacts/workstation'/('b-recovery-safety-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True,exist_ok=False)
    files=['scripts/b-pacs-maintenance.py','scripts/b-pacs-receiver-start.py','scripts/b-pacs-audit-recovery-infra.py',
        'scripts/b-pacs-vault-restore.py','scripts/b-pacs-vault-restore-guest.py','scripts/b-pacs-audit-query.py',
        'infra/azure/b-pacs-key-restore-role.json','infra/workstation/hospital-b-pacs-receiver.compose.yml']
    hashes=lambda:{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}
    result=dict(review='DRAFT / UNASSIGNED',observedAt=datetime.now(timezone.utc).isoformat(),sourceHashes=hashes(),checks=[])
    result['head']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,timeout=5).decode().strip()
    result['dirty']=bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,timeout=5).strip())
    for name,cmd in [('PYTHON_RECOVERY_SAFETY',[sys.executable,'-m','unittest','discover','-s','test','-p','b_pacs_*test.py']),
                     ('NODE_STORAGE_BOUNDARY',['node','--test','test/b-pacs-storage-boundary.test.js'])]:
        start=time.monotonic();p=subprocess.run(cmd,cwd=ROOT,capture_output=True,timeout=90)
        (folder/(name+'.txt')).write_bytes(p.stdout+p.stderr)
        result['checks'].append(dict(test=name,command=cmd,exitCode=p.returncode,durationMs=round((time.monotonic()-start)*1000),status='PASS' if p.returncode==0 else 'FAIL'))
    result['sourceUnchangedDuringChecks']=result['sourceHashes']==hashes()
    result['status']='PASS' if result['sourceUnchangedDuringChecks'] and all(c['status']=='PASS' for c in result['checks']) else 'FAIL'
    result['liveReboot']='NOT VERIFIED';result['live700Transfer']='NOT VERIFIED'
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
