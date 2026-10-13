"""Narrow B-only private recovery Vault route. No tunnel restart or firewall flush."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import pathlib
import re
from datetime import datetime,timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('recovery_network_check',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
INSPECT='''import subprocess,json,pathlib,hashlib
def read(args):return subprocess.check_output(args,timeout=8).decode().strip()
role=ROLE
path=pathlib.Path('/etc/highpass/capstone-overlay/firewall.sh' if role=='CLOUD' else '/etc/wireguard/hp-capstone.conf')
text=path.read_text()
print(json.dumps(dict(role=role,path=str(path),configSha256=hashlib.sha256(text.encode()).hexdigest(),
 interfaces=read(['wg','show','interfaces']),
 allowedIps=read(['wg','show','hp-capstone','allowed-ips']) if role=='B' else None,
 routes=json.loads(read(['ip','-j','-4','route','show','10.89.1.5/32'])) if role=='B' else None,
 forwardRules=read(['iptables','-S','HP-CAP-WG-F']).splitlines() if role=='CLOUD' else None,
 natRules=[l for l in read(['iptables','-t','nat','-S','POSTROUTING']).splitlines() if '10.89.1.' in l] if role=='CLOUD' else None)))'''

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--resume-cloud-receipt');args=parser.parse_args()
    folder=ROOT/'artifacts/workstation'/('b-recovery-network-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
    result=dict(review='DRAFT / UNASSIGNED',observedAt=datetime.now(timezone.utc).isoformat(),checks=[])
    password=getpass.getpass('B VM password (concealed): ');clients={}
    try:
        for role in ['CLOUD','B']:
            clients[role]=check.connect(role,password if role=='B' else None)
            result.setdefault('before',{})[role]=check.remote(clients[role],role,password if role=='B' else None,INSPECT.replace('ROLE',repr(role)),25)
        if not args.apply:result['status']='PASS';return 0
        cloud=result['before']['CLOUD'];b=result['before']['B']
        expected=hashlib.sha256((ROOT/'scripts/capstone-overlay-firewall.sh').read_text().replace('\r\n','\n').encode()).hexdigest()
        resume=None
        if args.resume_cloud_receipt:
            receipt_path=pathlib.Path(args.resume_cloud_receipt).resolve()
            if not receipt_path.is_relative_to(ROOT/'artifacts/workstation') or receipt_path.name!='result.json':raise RuntimeError('OWNED_PARTIAL_RECEIPT_REQUIRED')
            receipt=json.loads(receipt_path.read_text())
            checks=receipt.get('checks',[])
            if len(checks)!=1 or checks[0].get('status')!='PASS' or checks[0].get('before')!=expected or cloud['configSha256']!=checks[0].get('after'):
                raise RuntimeError('EXACT_PARTIAL_CLOUD_STATE_REQUIRED')
            if not any('-d 10.89.1.5/32' in rule and '-s 10.90.88.3/32' in rule and '--dport 443' in rule and '-j ACCEPT' in rule for rule in cloud['forwardRules']):raise RuntimeError('CLOUD_FORWARD_RULE_REQUIRED')
            if not any('-d 10.89.1.5/32' in rule and '-s 10.90.88.3/32' in rule and '--dport 443' in rule and '-j MASQUERADE' in rule for rule in cloud['natRules']):raise RuntimeError('CLOUD_NAT_RULE_REQUIRED')
            resume=checks[0]
        elif cloud['configSha256']!=expected:raise RuntimeError('CLOUD_FIREWALL_SOURCE_CHANGED_REVIEW_REQUIRED')
        peers=[line.split() for line in b['allowedIps'].splitlines()]
        allowed=set(re.split(r'[ ,]+',' '.join(peers[0][1:]))) if len(peers)==1 else set()
        if len(peers)!=1 or allowed!={'10.90.88.1/32','10.90.88.2/32','10.89.1.4/32'} or b['routes']:
            raise RuntimeError('UNEXPECTED_B_ROUTE_BASELINE')
        if 'hp-capstone' not in cloud['interfaces'].split() or 'hp-capstone' not in b['interfaces'].split():raise RuntimeError('EXISTING_TUNNEL_REQUIRED')
        # Backup exclusive; atomic replacement only if source hash still matches.
        common='''import subprocess,json,pathlib,hashlib,os,stat
def run(args):subprocess.run(args,check=True,capture_output=True,timeout=8)
def replace_owned(path,before,text):
 info=path.lstat()
 if not stat.S_ISREG(info.st_mode) or info.st_uid!=0:raise RuntimeError('ROOT_OWNED_CONFIG_REQUIRED')
 old=path.read_bytes()
 if hashlib.sha256(old).hexdigest()!=before:raise RuntimeError('CONFIG_CHANGED')
 backup=path.with_name(path.name+'.b-recovery-20261013')
 with open(backup,'xb') as f:f.write(old)
 os.chmod(backup,0o600)
 temp=path.with_name(path.name+'.b-recovery-new-20261013')
 with open(temp,'xb') as f:f.write(text.encode());f.flush();os.fsync(f.fileno())
 os.chmod(temp,stat.S_IMODE(info.st_mode));os.replace(temp,path)
 return dict(before=before,after=hashlib.sha256(text.encode()).hexdigest(),backup=str(backup))
'''
        cloud_program=common+r'''path=pathlib.Path('/etc/highpass/capstone-overlay/firewall.sh')
text=path.read_text()
forward='ipt -A HP-CAP-WG-F -i hp-capstone -s 10.90.88.3/32 -d 10.89.1.5/32 -p tcp --dport 443 -j ACCEPT'
nat='ipt -t nat -A POSTROUTING -s 10.90.88.3/32 -d 10.89.1.5/32 -p tcp --dport 443 -o eth0 -j MASQUERADE'
delete='ipt -t nat -D POSTROUTING -s 10.90.88.3/32 -d 10.89.1.5/32 -p tcp --dport 443 -o eth0 -j MASQUERADE || true'
for marker in ['  ipt -A HP-CAP-WG-F -j DROP','  ipt -A HP-CAP-WG-I -j DROP','  for chain in HP-CAP-WG-F HP-CAP-WG-I;']:
 if text.count(marker)!=1:raise RuntimeError('EXACT_FIREWALL_MARKER_REQUIRED')
text=text.replace('  ipt -A HP-CAP-WG-F -j DROP','  '+forward+'\n  ipt -A HP-CAP-WG-F -j DROP')
text=text.replace('  ipt -A HP-CAP-WG-I -j DROP','  '+nat+'\n  ipt -A HP-CAP-WG-I -j DROP')
text=text.replace('  for chain in HP-CAP-WG-F HP-CAP-WG-I;','  '+delete+'\n  for chain in HP-CAP-WG-F HP-CAP-WG-I;')
record=replace_owned(path,EXPECTED,text)
rule=['-i','hp-capstone','-s','10.90.88.3/32','-d','10.89.1.5/32','-p','tcp','--dport','443','-j','ACCEPT']
run(['iptables','-w','3','-I','HP-CAP-WG-F','3',*rule])
run(['iptables','-w','3','-C','HP-CAP-WG-F',*rule])
nat=['-s','10.90.88.3/32','-d','10.89.1.5/32','-p','tcp','--dport','443','-o','eth0','-j','MASQUERADE']
run(['iptables','-w','3','-t','nat','-A','POSTROUTING',*nat])
run(['iptables','-w','3','-t','nat','-C','POSTROUTING',*nat])
print(json.dumps(dict(status='PASS',**record)))'''.replace('EXPECTED',repr(cloud['configSha256']))
        result['checks'].append({**resume,'reusedVerifiedCloudChange':True} if resume else check.remote(clients['CLOUD'],'CLOUD',None,cloud_program,35))
        b_program=common+'''path=pathlib.Path('/etc/wireguard/hp-capstone.conf')
text=path.read_text()
lines=[l for l in text.splitlines() if l.startswith('AllowedIPs = ')]
if len(lines)!=1:raise RuntimeError('ONE_CLOUD_PEER_REQUIRED')
ips=lines[0].split('=',1)[1].strip()
if set(x.strip() for x in ips.split(','))!={'10.90.88.1/32','10.90.88.2/32','10.89.1.4/32'}:raise RuntimeError('EXACT_ALLOWED_IPS_REQUIRED')
text=text.replace(lines[0],lines[0]+', 10.89.1.5/32')
record=replace_owned(path,EXPECTED,text)
run(['wg','set','hp-capstone','peer',__PEER__,'allowed-ips',ips.replace(' ','')+',10.89.1.5/32'])
run(['ip','route','add','10.89.1.5/32','dev','hp-capstone'])
probe=subprocess.run(['curl','--silent','--show-error','--connect-timeout','3','--max-time','10','--resolve','kv-hp-recover-4869edd9.vault.azure.net:443:10.89.1.5','--output','/dev/null','--write-out','%{http_code},%{remote_ip},%{ssl_verify_result}','https://kv-hp-recover-4869edd9.vault.azure.net/keys?api-version=2025-07-01'],capture_output=True,timeout=12)
proof=probe.stdout.decode().strip()
print(json.dumps(dict(status='PASS' if probe.returncode==0 and proof=='401,10.89.1.5,0' else 'FAIL',tlsHttpProof=proof,transportExitCode=probe.returncode,**record)))'''.replace('EXPECTED',repr(b['configSha256'])).replace('__PEER__',repr(peers[0][0]))
        result['checks'].append(check.remote(clients['B'],'B',password,b_program,35))
        result['status']='PASS' if all(c['status']=='PASS' for c in result['checks']) else 'FAIL'
        for role in ['CLOUD','B']:result.setdefault('after',{})[role]=check.remote(clients[role],role,password if role=='B' else None,INSPECT.replace('ROLE',repr(role)),25)
    except Exception as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    finally:
        for client in clients.values():client.close()
        password=None
        (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
        print(json.dumps(dict(evidence=str(folder/'result.json'),**result)),flush=True)
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
