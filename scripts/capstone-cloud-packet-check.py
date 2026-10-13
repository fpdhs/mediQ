"""Bounded SYN-header-only ingress/PG boundary probe on the existing cloud stack."""
import json
import os
import pathlib
import shlex
import sys
from datetime import datetime, timezone
import paramiko
import importlib.util
import inspect
import textwrap
import argparse

ROOT=pathlib.Path(__file__).resolve().parent.parent
LEGACY_CONTROL='sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
EXPIRY_CONTROL='sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b'
spec=importlib.util.spec_from_file_location('packet_drain',ROOT/'scripts/capstone-phantom-audit-check.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)

def classify_packet_result(positive,negative,packets):
    if negative=='CONNECTED':return 'FAIL'
    if set(packets)!= {'source','destination'}:return 'NOT VERIFIED'
    passed=(positive=='CONNECTED' and negative=='ETIMEDOUT'
            and packets['source']['negativeSyn']>0 and packets['destination']['negativeSyn']==0
            and packets['destination']['positiveSyn']>0 and all(p['lossFree'] for p in packets.values()))
    return 'PASS' if passed else 'NOT VERIFIED'
PROGRAM=r'''
import json,subprocess,select,time,os,signal,re,shutil
names=['hp-capstone-control-ingress-1','hp-capstone-control-control-1','hp-capstone-control-postgres-1']
expected=['sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb','sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df','sha256:8d0e686f1620c154c0c35ba8c7173a90f8f1a55ff8062f75677be1f3a4196568']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=10))
assert all(i['Image']==e and i['State']['Running'] and i['State']['Pid']>0 for i,e in zip(items,expected)), 'CURRENT_IMAGE_OR_RUNNING_MISMATCH'
source,control,target=items
network='hp-capstone-control_db_private'
assert network in control['NetworkSettings']['Networks'] and network in target['NetworkSettings']['Networks']
assert not set(source['NetworkSettings']['Networks']) & set(target['NetworkSettings']['Networks'])
assert not target['HostConfig']['PortBindings'], 'DB_PUBLISHED_PORT'
assert all(shutil.which(x) for x in ['nsenter','tcpdump','timeout'])
ip=target['NetworkSettings']['Networks'][network]['IPAddress']
positive_port,negative_port=60241,60242
filter='tcp and dst host '+ip+' and dst port 5432 and tcp[tcpflags] & tcp-syn != 0 and (src port '+str(positive_port)+' or src port '+str(negative_port)+')'
captures=[];outcome={'scope':'ACTUAL_CLOUD_INGRESS_TO_PG_DUAL_NAMESPACE_SYN_HEADERS','images':dict(zip(names,expected)),'review':'DRAFT / UNASSIGNED','status':'NOT VERIFIED'}
def probe(container,port):
 code="const net=require('node:net');let done=false;const s=net.connect({host:"+json.dumps(ip)+",port:5432,localPort:"+str(port)+"});const end=result=>{if(done)return;done=true;console.log(JSON.stringify({result}));s.destroy();};s.on('connect',()=>end('CONNECTED'));s.on('error',e=>end(e.code));setTimeout(()=>end('ETIMEDOUT'),3000).unref();"
 return json.loads(subprocess.check_output(['docker','exec',container,'/nodejs/bin/node','-e',code],timeout=8))['result']
try:
 for side,item in [('source',source),('destination',target)]:
  process=subprocess.Popen(['timeout','20s','nsenter','-t',str(item['State']['Pid']),'-n','tcpdump','-p','-l','-nn','-i','any',filter],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
  capture={'side':side,'process':process,'prefix':''};captures.append(capture)
  deadline=time.monotonic()+5;ready=False
  while time.monotonic()<deadline:
   if select.select([process.stderr],[],[],0.2)[0]:
    chunk=os.read(process.stderr.fileno(),4096).decode('utf8','replace');capture['prefix']+=chunk
    if 'listening on' in capture['prefix']:ready=True;break
   if process.poll() is not None:break
  assert ready, 'CAPTURE_NOT_READY'
 positive=probe(names[1],positive_port)
 negative=probe(names[0],negative_port)
 time.sleep(0.4)
 packets={}
 for capture in captures:
  process=capture['process']
  if process.poll() is None:os.killpg(process.pid,signal.SIGINT)
  stdout,stderr=process.communicate(timeout=5)
  text=stdout+capture['prefix']+stderr
  packets[capture['side']]={'headers':stdout,'lossFree':bool(re.search(r'(?:^|\n)0 packets dropped by kernel(?:\n|$)',text)),
   'negativeSyn':sum('Flags [S]' in line and '.'+str(negative_port)+' >' in line for line in stdout.splitlines()),
   'positiveSyn':sum('Flags [S]' in line and '.'+str(positive_port)+' >' in line for line in stdout.splitlines())}
 outcome.update({'positiveControl':positive,'negativeTransport':negative,'packets':packets,'status':classify_packet_result(positive,negative,packets)})
except Exception as error:outcome['reason']=type(error).__name__
finally:
 cleanup=True
 for capture in captures:
  process=capture['process']
  if process.poll() is None:
   try:os.killpg(process.pid,signal.SIGTERM);process.communicate(timeout=3)
   except Exception:
    cleanup=False
    if process.poll() is None:os.killpg(process.pid,signal.SIGKILL);process.communicate(timeout=3)
 outcome['captureCleanup']=cleanup and all(c['process'].poll() is not None for c in captures)
 if not outcome['captureCleanup']:outcome['status']='NOT VERIFIED'
print(json.dumps(outcome))
'''

def pinned_program(image):
    if image not in [LEGACY_CONTROL,EXPIRY_CONTROL] or PROGRAM.count(LEGACY_CONTROL)!=1:
        raise ValueError('EXACT_REVIEWED_CONTROL_IMAGE_REQUIRED')
    return PROGRAM.replace(LEGACY_CONTROL,image)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--expected-control-image',choices=[LEGACY_CONTROL,EXPIRY_CONTROL],default=LEGACY_CONTROL)
    args=parser.parse_args()
    client=paramiko.SSHClient()
    try:
        identity=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        channel=client.get_transport().open_session(timeout=10);channel.settimeout(45)
        guarded='import json\ntry:\n'+textwrap.indent(inspect.getsource(classify_packet_result)+'\n'+pinned_program(args.expected_control_image),' ')+'\nexcept Exception as error:\n print(json.dumps({"status":"NOT VERIFIED","reason":type(error).__name__}))\n'
        channel.exec_command('sudo -n timeout 40s python3 -c '+shlex.quote(guarded))
        code,output=ops.drain_channel(channel,seconds=45)
        result=json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'REMOTE_EXIT_MISMATCH'}
    except Exception as error:result={'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:client.close()
    path=ROOT/'artifacts/workstation'/('cloud-packet-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json')
    result['review']='DRAFT / UNASSIGNED';result['expectedControlImage']=args.expected_control_image;path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({**result,'evidence':str(path)}),flush=True)
    return 0 if result.get('status')=='PASS' else 1 if result.get('status')=='FAIL' else 2

if __name__=='__main__':sys.exit(main())
