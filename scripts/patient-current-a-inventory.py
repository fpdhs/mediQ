"""Read-only current A image/tag and PACS readiness diagnostic; no runtime values."""
import getpass
import importlib.util
import json
import pathlib
import shlex
import paramiko

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('a_inventory_ops',ROOT/'scripts/workstation-automatic-ops.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)


def main():
    credential=getpass.getpass('VM credential (concealed): ')
    client=paramiko.SSHClient();trust=None
    try:
        trust=ops.LocalVmTrust()
        key=trust.key('A',credential,ROOT/'artifacts/workstation/A-inventory-public-host.key')
        address,mac,_=ops.ROLES['A'];client.get_host_keys().add(address,key.get_name(),key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        program='MAC='+repr(mac)+'\n'+r'''
import subprocess,json,pathlib
assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],timeout=10).decode().splitlines()
selected=[n for n in names if n.startswith(('hp-capstone-hospital-a-','hp-capstone-a-gateway-'))]
assert selected
items=json.loads(subprocess.check_output(['docker','inspect',*selected],timeout=10))
rows=[]
for item in items:
 image=json.loads(subprocess.check_output(['docker','image','inspect',item['Image']],timeout=10))[0]
 rows.append({'name':item['Name'],'imageId':item['Image'],'tags':image.get('RepoTags',[]),'running':item['State']['Running'],'health':item['State'].get('Health',{}).get('Status','NOT CONFIGURED')})
print(json.dumps({'scope':'READ_ONLY_A_IMAGE_TAG_PACS_READINESS_NOT_MTLS_TEST','containers':rows,'review':'DRAFT / UNASSIGNED'}))
'''
        code,output=ops.run(client,"sudo -S -p '' timeout 45s python3 -c "+shlex.quote(program),credential=credential,seconds=50)
        if code:raise RuntimeError('A_INVENTORY_FAILED')
        print(json.dumps(json.loads(output)),flush=True)
        return 0
    finally:
        client.close()
        if trust:trust.close()
        credential=None


if __name__=='__main__':raise SystemExit(main())
