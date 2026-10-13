"""Exact A/B VM TCP boundary; SYN headers only, no application payload or configuration changes."""
import getpass
import hashlib
import importlib.util
import json
import pathlib
import re
import shlex
import sys
import time
from datetime import datetime, timezone
import paramiko
import argparse

ROOT=pathlib.Path(__file__).resolve().parent.parent
LEGACY_PORTAL='sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a'
FAQ_PORTAL='sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1'
SESSION_PORTAL='sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e'
spec=importlib.util.spec_from_file_location('hospital_packet_ops',ROOT/'scripts/workstation-automatic-ops.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
spec=importlib.util.spec_from_file_location('hospital_packet_drain',ROOT/'scripts/capstone-phantom-audit-check.py')
drain=importlib.util.module_from_spec(spec);spec.loader.exec_module(drain)

def classify(positive,negative,captures):
    if negative=='CONNECTED':return 'FAIL'
    if set(captures)!= {'source','host','destination'}:return 'NOT VERIFIED'
    pattern=r'\.60252 > 192\.168\.111\.129\.8042: Flags \[S\], seq (\d+),'
    source_sequences=set(re.findall(pattern,captures['source'].get('headers','')))
    host_sequences=set(re.findall(pattern,captures['host'].get('headers','')))
    valid=(positive=='CONNECTED' and negative=='ECONNREFUSED'
           and captures['source']['negativeSyn']>0 and captures['host']['negativeSyn']>0
           and captures['destination']['negativeSyn']==0 and captures['destination']['positiveSyn']>0
           and bool(source_sequences) and source_sequences==host_sequences
           and all(c['lossFree'] and c['cleanup'] for c in captures.values()))
    return 'PASS' if valid else 'NOT VERIFIED'

COMMON=r'''
import json,subprocess,time,select,os,signal,re
captures=[]
def inspect(name,image):
 item=json.loads(subprocess.check_output(['docker','inspect',name],timeout=5))[0]
 assert item['Image']==image and item['State']['Running'] and item['State']['Pid']>0 and item['State'].get('Health',{}).get('Status')=='healthy', 'IMAGE_OR_READINESS_MISMATCH'
 return item
def start_capture(side,pid,ip):
 filter='tcp and dst host '+ip+' and dst port 8042 and tcp[tcpflags] & tcp-syn != 0 and (src port 60251 or src port 60252)'
 args=['timeout','20s']+(['nsenter','-t',str(pid),'-n'] if pid else [])+['tcpdump','-p','-l','-nn','-i','any',filter]
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
 capture={'side':side,'process':process,'prefix':''};captures.append(capture)
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  if select.select([process.stderr],[],[],0.2)[0]:
   capture['prefix']+=os.read(process.stderr.fileno(),4096).decode('utf8','replace')
   if 'listening on' in capture['prefix']:return
  if process.poll() is not None:break
 raise RuntimeError('CAPTURE_NOT_READY')
def probe(name,ip,port):
 code="const net=require('node:net');let done=false;const s=net.connect({host:"+json.dumps(ip)+",port:8042,localPort:"+str(port)+"});const end=result=>{if(done)return;done=true;console.log(JSON.stringify({result}));s.destroy();};s.on('connect',()=>end('CONNECTED'));s.on('error',e=>end(e.code));setTimeout(()=>end('ETIMEDOUT'),3000).unref();"
 return json.loads(subprocess.check_output(['docker','exec',name,'/nodejs/bin/node','-e',code],timeout=8))['result']
def stop_captures():
 result={}
 for c in captures:
  p=c['process'];clean=True
  try:
   if p.poll() is None:os.killpg(p.pid,signal.SIGINT)
   stdout,stderr=p.communicate(timeout=4)
  except Exception:
   clean=False
   if p.poll() is None:os.killpg(p.pid,signal.SIGKILL)
   stdout,stderr=p.communicate(timeout=3)
  text=stdout+c['prefix']+stderr
  result[c['side']]={'headers':stdout,'cleanup':clean and p.poll() is not None,
   'lossFree':bool(re.search(r'(?:^|\n)0 packets dropped by kernel(?:\n|$)',text)),
   'negativeSyn':sum('Flags [S]' in l and '.60252 >' in l for l in stdout.splitlines()),
   'positiveSyn':sum('Flags [S]' in l and '.60251 >' in l for l in stdout.splitlines())}
 return result
'''
A_PROGRAM=COMMON+r'''
outcome={}
try:
 pacs=inspect('hp-capstone-hospital-a-orthanc-1','sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a')
 proxy=inspect('hp-capstone-hospital-a-orthanc-mtls-1','sha256:853ed9b5269a6781eff54b29942f6368c9d14f6a36add88ebdb5dcc1b0744802')
 assert not pacs['HostConfig']['PortBindings'], 'RAW_PACS_PUBLISHED'
 network='hp-capstone-hospital-a_pacs_private'
 assert network in proxy['NetworkSettings']['Networks']
 ip=pacs['NetworkSettings']['Networks'][network]['IPAddress']
 start_capture('host',None,'192.168.111.129')
 start_capture('destination',pacs['State']['Pid'],ip)
 print(json.dumps({'ready':True}),flush=True)
 outcome={'positive':probe('hp-capstone-hospital-a-orthanc-mtls-1',ip,60251),'pacsImage':pacs['Image'],'proxyImage':proxy['Image']}
 time.sleep(10)
except Exception as error:outcome={'reason':type(error).__name__}
finally:outcome['captures']=stop_captures()
print(json.dumps(outcome),flush=True)
'''
B_PROGRAM=COMMON+r'''
outcome={}
try:
 portal=inspect('hp-capstone-b-portal-portal-1','sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a')
 start_capture('source',portal['State']['Pid'],'192.168.111.129')
 outcome={'negative':probe('hp-capstone-b-portal-portal-1','192.168.111.129',60252),'portalImage':portal['Image']}
 time.sleep(0.4)
except Exception as error:outcome={'reason':type(error).__name__}
finally:outcome['captures']=stop_captures()
print(json.dumps(outcome),flush=True)
'''

def pinned_b_program(image):
    if image not in [LEGACY_PORTAL,FAQ_PORTAL,SESSION_PORTAL] or B_PROGRAM.count(LEGACY_PORTAL)!=1:
        raise ValueError('EXACT_REVIEWED_PORTAL_IMAGE_REQUIRED')
    return B_PROGRAM.replace(LEGACY_PORTAL,image)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--expected-portal-image',choices=[LEGACY_PORTAL,FAQ_PORTAL,SESSION_PORTAL],default=LEGACY_PORTAL)
    args=parser.parse_args()
    credential=getpass.getpass('VM credential (concealed): ')
    started=time.monotonic()
    directory=ROOT/'artifacts/workstation'/('hospital-packet-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    trust=ops.LocalVmTrust();clients={};channel=None;result={'status':'NOT VERIFIED'}
    try:
        for role in ['A','B']:
            key=trust.key(role,credential,directory/(role+'-public-host.key'))
            address,mac,_=ops.ROLES[role]
            client=paramiko.SSHClient();clients[role]=client
            client.get_host_keys().add(address,key.get_name(),key);client.set_missing_host_key_policy(paramiko.RejectPolicy())
            client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
            code,_=ops.run(client,'test "$(cat /sys/class/net/ens33/address)" = '+shlex.quote(mac),seconds=10)
            if code:raise RuntimeError('VM_ROLE_MISMATCH')
        channel=clients['A'].get_transport().open_session(timeout=10);channel.settimeout(30)
        channel.exec_command("sudo -S -p '' timeout 30s python3 -c "+shlex.quote(A_PROGRAM));channel.sendall((credential+'\n').encode());channel.shutdown_write()
        buffer=bytearray();deadline=time.monotonic()+12
        while b'\n' not in buffer and time.monotonic()<deadline:
            if channel.recv_ready():buffer.extend(channel.recv(4096))
            elif channel.exit_status_ready():break
            else:time.sleep(0.05)
        first,sep,remainder=bytes(buffer).partition(b'\n')
        if not sep or json.loads(first).get('ready') is not True:raise RuntimeError('A_CAPTURE_NOT_READY')
        code,b_output=ops.run(clients['B'],"sudo -S -p '' timeout 20s python3 -c "+shlex.quote(pinned_b_program(args.expected_portal_image)),credential=credential,seconds=25)
        if code:raise RuntimeError('B_PROBE_PROCESS_FAILED')
        b=json.loads(b_output)
        code,a_output=drain.drain_channel(channel,seconds=25);channel=None
        if code:raise RuntimeError('A_PROBE_PROCESS_FAILED')
        a=json.loads(remainder.decode()+a_output)
        captures={**a.get('captures',{}),**b.get('captures',{})}
        result={'status':classify(a.get('positive'),b.get('negative'),captures),
                'positiveControl':a.get('positive'),'negativeTransport':b.get('negative'),'captures':captures,
                'images':{key:value for row in [a,b] for key,value in row.items() if key.endswith('Image')},
                'diagnostics':{key:row['reason'] for key,row in [('A',a),('B',b)] if 'reason' in row}}
    except Exception as error:result={'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:
        if channel:channel.close()
        for client in clients.values():client.close()
        trust.close();credential=None
    result.update({'scope':'B_PORTAL_TO_A_HOST_RAW_PACS_SOURCE_HOST_DESTINATION_SYN_HEADERS','review':'DRAFT / UNASSIGNED',
                   'elapsedMs':round((time.monotonic()-started)*1000),'observedAt':datetime.now(timezone.utc).isoformat(),
                   'hostToolSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
                   'expectedPortalImage':args.expected_portal_image})
    path=directory/'result.json';path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({**result,'evidence':str(path)}),flush=True)
    return 0 if result['status']=='PASS' else 1 if result['status']=='FAIL' else 2

if __name__=='__main__':sys.exit(main())
