"""Read-only packet-probe prerequisites; never reads container environment/mount secrets."""
import getpass
import importlib.util
import json
import os
import pathlib
import shlex
import sys
from datetime import datetime, timezone
import paramiko

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('packet_vm_ops',ROOT/'scripts/workstation-automatic-ops.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
PROGRAM=r'''
import json,subprocess,shutil
names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],timeout=10).decode().splitlines()
names=[name for name in names if name.startswith(('hp-capstone-hospital-a-','hp-capstone-a-gateway-','hp-capstone-b-portal-','hp-capstone-control-'))]
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=10)) if names else []
rows=[]
for item in items:
 rows.append({'name':item['Name'],'image':item['Image'],'pid':item['State']['Pid'],
 'running':item['State']['Running'],'health':item['State'].get('Health',{}).get('Status','NOT CONFIGURED'),
 'bindings':item['HostConfig']['PortBindings'],
 'networks':{name:{'ip':value['IPAddress'],'networkId':value['NetworkID']} for name,value in item['NetworkSettings']['Networks'].items()}})
print(json.dumps({'containers':rows,'tools':{name:shutil.which(name) is not None for name in ['tcpdump','nsenter','timeout']}}))
'''

def main():
    credential=getpass.getpass('VM credential (concealed): ')
    directory=ROOT/'artifacts/workstation'/('packet-inventory-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    trust=ops.LocalVmTrust();rows=[]
    try:
        for role in ['A','B','CLOUD']:
            client=paramiko.SSHClient()
            try:
                if role=='CLOUD':
                    identity=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
                    client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
                    client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
                else:
                    key=trust.key(role,credential,directory/(role+'-public-host.key'))
                    address,mac,_=ops.ROLES[role];client.get_host_keys().add(address,key.get_name(),key);client.set_missing_host_key_policy(paramiko.RejectPolicy())
                    client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
                    code,_=ops.run(client,'test "$(cat /sys/class/net/ens33/address)" = '+shlex.quote(mac),seconds=10)
                    if code:raise RuntimeError('VM_ROLE_MISMATCH')
                command=('sudo -n ' if role=='CLOUD' else "sudo -S -p '' ")+'timeout 25s python3 -c '+shlex.quote(PROGRAM)
                code,output=ops.run(client,command,credential=None if role=='CLOUD' else credential,seconds=30)
                if code:raise RuntimeError('INVENTORY_FAILED')
                rows.append({'role':role,'status':'COLLECTED',**json.loads(output)})
            except Exception as error:rows.append({'role':role,'status':'NOT VERIFIED','reason':type(error).__name__})
            finally:client.close()
    finally:trust.close();credential=None
    result={'scope':'READ_ONLY_RUNTIME_PACKET_PREREQUISITES_NOT_BOUNDARY_PASS','review':'DRAFT / UNASSIGNED','hosts':rows}
    path=directory/'result.json';path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({**result,'evidence':str(path)}),flush=True)
    return 0 if all(row['status']=='COLLECTED' for row in rows) else 2

if __name__=='__main__':sys.exit(main())
