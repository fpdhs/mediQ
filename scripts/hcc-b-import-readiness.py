"""Read-only deployed B destination and cloud-boundary check; no consent or import."""
import getpass,importlib.util,json,pathlib
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('check',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(s);s.loader.exec_module(check)
PROGRAM=r'''
import subprocess,json
names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],timeout=10).decode().splitlines()
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=10)) if names else []
rows=[]
for i in items:
 env=dict(v.split('=',1) for v in i['Config'].get('Env',[]) if '=' in v)
 rows.append(dict(name=i['Name'],image=i['Image'],running=i['State']['Running'],health=i['State'].get('Health',{}).get('Status'),controlPlaneOnly=env.get('HIPASS_CONTROL_PLANE_ONLY'),archiveWorkerConfigured=bool(env.get('HIPASS_ARCHIVE_RETENTION_ROOT')),mountDestinations=[m['Destination'] for m in i.get('Mounts',[])]))
print(json.dumps(rows))
'''
def main():
 password=getpass.getpass('B VM password (concealed): ')
 out=dict(observedAt=datetime.now(timezone.utc).isoformat(),scope='READ_ONLY_B_DESTINATION_PREFLIGHT',review='DRAFT / UNASSIGNED',consentCreated=False,importExecuted=False)
 try:
  for role in ['B','CLOUD']:
   c=check.connect(role,password if role=='B' else None)
   try:out[role]=check.remote(c,role,password if role=='B' else None,PROGRAM,25)
   finally:c.close()
 finally:password=None
 out['destinationPacsContainers']=[i['name'] for i in out['B'] if any(word in i['name'].lower() for word in ['orthanc','pacs','dcm4chee'])]
 directory=ROOT/'artifacts/workstation'/('hcc-b-import-readiness-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
 directory.mkdir(parents=True,exist_ok=False)
 (directory/'result.json').write_text(json.dumps(out,indent=2))
 print(json.dumps(dict(evidence=str(directory/'result.json'),**out)))
if __name__=='__main__':main()
