"""Remote fixed-scope B public TLS entry phases. Clinical routing stays closed."""
import json
import pathlib
import subprocess
import os
import pwd
import hashlib

BASE = pathlib.Path('/opt/highpass/patient-public-entry')
HOST = 'highpass-images-b.japaneast.cloudapp.azure.com'


def write(path, text, mode=0o644):
    path.write_text(text, encoding='utf-8')
    path.chmod(mode)


def caddyfile(production):
    ca = 'acme-v02' if production else 'acme-staging-v02'
    return '''{
 admin off
 auto_https disable_redirects
 https_port 9444
 log default {
  level ERROR
 }
 servers {
  protocols h1 h2
  max_header_size 16KB
  timeouts {
   read_header 5s
   read_body 5s
   write 10s
   idle 15s
  }
 }
}
'''+HOST+''' {
 bind 10.90.88.3
 tls {
  protocols tls1.2 tls1.3
  issuer acme {
   dir https://'''+ca+'''.api.letsencrypt.org/directory
   disable_http_challenge
  }
 }
 header {
  -Server
  Cache-Control "no-store"
  X-Content-Type-Options "nosniff"
  Content-Type "application/json"
 }
 respond `{"error":"PATIENT_IMAGE_ENTRY_NOT_ENABLED"}` 403
}
'''


def stage_b():
    assert ':9444 ' not in run(['ss', '-lnt'])
    if BASE.exists():
        # Resume only this operator's incomplete, never-started candidate.
        assert {p.name for p in BASE.iterdir()} == {'data', 'config', 'image.json', 'compose.json', 'Caddyfile'}
        assert not pathlib.Path('/etc/systemd/system/hp-patient-public-tls.service').exists()
        image_info = json.loads((BASE / 'image.json').read_text())
        image = json.loads(run(['docker', 'image', 'inspect', image_info['id']]))[0]
        assert image['RepoDigests'] == image_info['digests']
    else:
        BASE.mkdir(mode=0o755)
        pull = subprocess.run(['docker', 'pull', 'caddy:2-alpine'], capture_output=True, text=True, timeout=45)
        if pull.returncode:
            raise RuntimeError('CADDY_PULL_FAILED')
        image = json.loads(run(['docker', 'image', 'inspect', 'caddy:2-alpine']))[0]
    # Official Caddy only; capture the immutable image before starting anything.
    write(BASE / 'image.json', json.dumps({'id': image['Id'], 'digests': image['RepoDigests']}))
    for part in ['data', 'config']:
        directory = BASE / part
        directory.mkdir(mode=0o700, exist_ok=True)
        os.chown(directory, 1000, 1000)
    write(BASE / 'Caddyfile', caddyfile(False))
    compose = {'services': {'tls': {
        'image': image['Id'], 'user': '1000:1000', 'network_mode': 'host',
        'command': ['caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'],
        'volumes': [str(BASE / 'Caddyfile') + ':/etc/caddy/Caddyfile:ro', str(BASE / 'data') + ':/data', str(BASE / 'config') + ':/config'],
        'read_only': True, 'tmpfs': ['/tmp:rw,nosuid,nodev,noexec,size=16m'],
        'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'],
        'mem_limit': '128m', 'pids_limit': 64, 'restart': 'no',
        'logging': {'driver': 'json-file', 'options': {'max-size': '2m', 'max-file': '2'}}}}}
    write(BASE / 'compose.json', json.dumps(compose))
    run(['docker', 'run', '--rm', '--network=none', '--read-only', '--tmpfs', '/tmp', '-v', str(BASE / 'Caddyfile') + ':/etc/caddy/Caddyfile:ro', image['Id'], 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
    firewall = '''import subprocess
def r(*args):subprocess.run(['iptables','-w','5',*args],check=True,capture_output=True)
def exists(*args):return subprocess.run(['iptables','-w','5',*args],capture_output=True).returncode==0
if not exists('-S','HP-PVIEW-IN'):
 r('-N','HP-PVIEW-IN')
 r('-A','HP-PVIEW-IN','-i','hp-capstone','-s','10.90.88.1/32','-j','ACCEPT')
 r('-A','HP-PVIEW-IN','-j','DROP')
if not exists('-C','INPUT','-d','10.90.88.3/32','-p','tcp','--dport','9444','-j','HP-PVIEW-IN'):
 r('-I','INPUT','1','-d','10.90.88.3/32','-p','tcp','--dport','9444','-j','HP-PVIEW-IN')
'''
    write(BASE / 'prepare.py', firewall, 0o600)
    unit = '''[Unit]
Description=Highpass B public TLS entry (clinical routes closed)
Requires=docker.service wg-quick@hp-capstone.service
After=docker.service wg-quick@hp-capstone.service network-online.target
[Service]
Type=simple
ExecStartPre=/usr/bin/python3 /opt/highpass/patient-public-entry/prepare.py
ExecStart=/usr/bin/docker compose -p hp-patient-public-tls -f /opt/highpass/patient-public-entry/compose.json up --no-color --pull never --abort-on-container-exit
ExecStop=/usr/bin/docker compose -p hp-patient-public-tls -f /opt/highpass/patient-public-entry/compose.json stop -t 10
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
[Install]
WantedBy=multi-user.target
'''
    target = pathlib.Path('/etc/systemd/system/hp-patient-public-tls.service')
    assert not target.exists()
    write(target, unit)
    run(['systemd-analyze', 'verify', str(target)])
    run(['systemctl', 'daemon-reload'])
    return {'status': 'PASS', 'image': image['Id'], 'digest': image['RepoDigests'], 'clinicalRoutes': 'DENY_ALL', 'started': False}


def stage_cloud():
    assert not BASE.exists(), 'EXISTING_ENTRY_REQUIRES_REVIEW'
    assert pathlib.Path('/usr/lib/systemd/systemd-socket-proxyd').exists()
    assert ':443 ' not in '\n'.join(x for x in run(['ss', '-lnt']).splitlines() if '10.89.0.5' in x)
    try:
        pwd.getpwnam('hp-b-video-relay')
        raise RuntimeError('EXISTING_SERVICE_USER')
    except KeyError:
        pass
    run(['useradd', '--system', '--no-create-home', '--shell', '/usr/sbin/nologin', 'hp-b-video-relay'])
    uid = pwd.getpwnam('hp-b-video-relay').pw_uid
    BASE.mkdir(mode=0o755)
    prepare = '''import subprocess,json
def r(*args):subprocess.run(['iptables','-w','5',*args],check=True,capture_output=True)
def exists(*args):return subprocess.run(['iptables','-w','5',*args],capture_output=True).returncode==0
ips=json.loads(subprocess.check_output(['ip','-j','address','show','dev','eth0']))[0]['addr_info']
if not any(x.get('local')=='10.89.0.5' for x in ips):subprocess.run(['ip','address','add','10.89.0.5/32','dev','eth0'],check=True)
if not exists('-S','HP-PVIEW-OUT'):
 r('-N','HP-PVIEW-OUT')
 r('-A','HP-PVIEW-OUT','-m','conntrack','--ctstate','ESTABLISHED,RELATED','-j','ACCEPT')
 r('-A','HP-PVIEW-OUT','-d','10.90.88.3/32','-p','tcp','--dport','9444','-j','ACCEPT')
 r('-A','HP-PVIEW-OUT','-j','REJECT')
if not exists('-C','OUTPUT','-m','owner','--uid-owner','''+repr(str(uid))+''','-j','HP-PVIEW-OUT'):
 r('-I','OUTPUT','1','-m','owner','--uid-owner','''+repr(str(uid))+''','-j','HP-PVIEW-OUT')
'''
    write(BASE / 'prepare.py', prepare, 0o600)
    units = {
      'hp-patient-entry-network.service': '''[Unit]
Description=Highpass secondary address and narrowly scoped relay firewall
Wants=network-online.target
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /opt/highpass/patient-public-entry/prepare.py
RemainAfterExit=yes
''',
      'hp-patient-entry.socket': '''[Unit]
Description=Highpass B encrypted TCP entry
Requires=hp-patient-entry-network.service
After=hp-patient-entry-network.service
[Socket]
ListenStream=10.89.0.5:443
NoDelay=true
Backlog=128
[Install]
WantedBy=sockets.target
''',
      'hp-patient-entry.service': '''[Unit]
Description=Highpass fixed B TCP relay (no TLS keys)
Requires=hp-patient-entry.socket
After=hp-patient-entry.socket
[Service]
ExecStart=/usr/lib/systemd/systemd-socket-proxyd --connections-max=64 --exit-idle-time=60s 10.90.88.3:9444
User=hp-b-video-relay
Group=hp-b-video-relay
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
MemoryMax=64M
TasksMax=32
LimitNOFILE=512
Restart=on-failure
RestartSec=3
'''}
    for name, content in units.items():
        target = pathlib.Path('/etc/systemd/system') / name
        assert not target.exists()
        write(target, content)
    run(['systemd-analyze', 'verify', *['/etc/systemd/system/' + name for name in units]])
    run(['systemctl', 'daemon-reload'])
    return {'status': 'PASS', 'relayUid': uid, 'tlsTermination': False, 'destination': '10.90.88.3:9444', 'started': False}


def run(args):
    process = subprocess.run(args, capture_output=True, text=True, timeout=20)
    if process.returncode:
        if BASE.exists():
            write(BASE / 'last-command-failure.json', json.dumps({'args': args, 'stderr': process.stderr[-1800:]}), 0o600)
        raise RuntimeError('SCOPED_COMMAND_FAILED')
    return process.stdout


def main(role, phase):
    assert role in ['B', 'CLOUD']
    if phase == 'stage':
        print(json.dumps(stage_b() if role == 'B' else stage_cloud()))
        return
    if phase in ['start-staging', 'start-production']:
        assert BASE.is_dir()
        if role == 'B':
            compose = json.loads((BASE / 'compose.json').read_text())
            image_info = json.loads((BASE / 'image.json').read_text())
            if compose['services']['tls']['image'] == image_info['id']:
                # Official image sets a binary capability. Remove it for the
                # unprivileged high-port service instead of granting capabilities.
                run(['systemctl', 'stop', 'hp-patient-public-tls.service'])
                base_digest = image_info['digests'][0]
                assert base_digest.startswith('caddy@sha256:')
                build = subprocess.run(['docker', 'build', '--network=none', '--pull=false', '-t', 'highpass-b-tls-nocap:20261013', '-'], input='FROM '+base_digest+'\nRUN setcap -r /usr/bin/caddy\nUSER 1000:1000\n', text=True, capture_output=True, timeout=35)
                if build.returncode:
                    write(BASE / 'build-error.txt', build.stderr[-2400:], 0o600)
                    raise RuntimeError('NO_CAPABILITY_BUILD_FAILED')
                derived = json.loads(run(['docker', 'image', 'inspect', 'highpass-b-tls-nocap:20261013']))[0]['Id']
                compose['services']['tls']['image'] = derived
                write(BASE / 'compose.json', json.dumps(compose))
                write(BASE / 'derived-image.json', json.dumps({'base': image_info['id'], 'id': derived, 'change': 'remove Caddy file capability; nonroot UID1000'}))
            write(BASE / 'Caddyfile', caddyfile(phase == 'start-production'))
            run(['systemctl', 'enable', 'hp-patient-public-tls.service'])
            run(['systemctl', 'restart', 'hp-patient-public-tls.service'])
        else:
            assert phase == 'start-staging'
            run(['systemctl', 'enable', '--now', 'hp-patient-entry.socket'])
        print(json.dumps({'status': 'PASS', 'started': True, 'clinicalRoutes': 'DENY_ALL'}))
        return
    if phase == 'verify':
        if role == 'B':
            items = json.loads(run(['docker', 'ps', '--filter', 'label=com.docker.compose.project=hp-patient-public-tls', '--format', 'json']).strip() or '{}')
            # Certificate metadata only. Never read .key or ACME account secrets.
            certificates = []
            for path in (BASE / 'data').rglob('*.crt'):
                cert = run(['openssl', 'x509', '-in', str(path), '-noout', '-issuer', '-subject', '-dates', '-fingerprint', '-sha256'])
                certificates.append(cert)
            result = {'service': run(['systemctl', 'is-active', 'hp-patient-public-tls.service']).strip(), 'containerState': items.get('State'), 'certificates': certificates,
                      'firewall': run(['iptables', '-S', 'HP-PVIEW-IN']), 'configSha256': hashlib.sha256((BASE/'Caddyfile').read_bytes()).hexdigest()}
            portal = json.loads(run(['docker', 'inspect', 'hp-capstone-b-portal-portal-1']))[0]
            tls = json.loads(run(['docker', 'inspect', 'hp-patient-public-tls-tls-1']))[0]
            result['containerState'] = tls['State']['Status']
            result['existingPortal'] = {'image': portal['Image'], 'health': portal['State'].get('Health', {}).get('Status')}
            result['tlsRuntime'] = {'image': tls['Image'], 'user': tls['Config']['User'], 'capDrop': tls['HostConfig']['CapDrop'], 'readonly': tls['HostConfig']['ReadonlyRootfs'], 'restartCount': tls['RestartCount']}
        else:
            result = {'socket': run(['systemctl', 'is-active', 'hp-patient-entry.socket']).strip(), 'firewall': run(['iptables', '-S', 'HP-PVIEW-OUT']), 'secondaryPresent': '10.89.0.5' in run(['ip', '-j', 'address', 'show', 'dev', 'eth0'])}
        print(json.dumps(result))
        return
    if phase == 'rollback':
        units = ['hp-patient-public-tls.service'] if role == 'B' else ['hp-patient-entry.socket', 'hp-patient-entry.service']
        for unit in units:
            run(['systemctl', 'stop', unit])
        print(json.dumps({'status': 'PASS', 'stopped': units, 'filesAndCertificatesPreserved': True}))
        return
    assert phase == 'inventory'
    if BASE.exists():
        result = {'entryFiles': [p.name for p in BASE.iterdir()]}
        for filename in ['last-command-failure.json', 'build-error.txt']:
            if (BASE / filename).exists():
                result[filename] = (BASE / filename).read_text()
        if role == 'B':
            result['serviceLog'] = subprocess.run(['journalctl', '-u', 'hp-patient-public-tls.service', '-n', '18', '--no-pager'], capture_output=True, text=True, timeout=10).stdout
        if role == 'B' and (BASE / 'image.json').exists() and (BASE / 'Caddyfile').exists():
            image = json.loads((BASE / 'image.json').read_text())
            validation = subprocess.run(['docker', 'run', '--rm', '--network=none', '--read-only', '--tmpfs', '/tmp', '-v', str(BASE / 'Caddyfile') + ':/etc/caddy/Caddyfile:ro', image['id'], 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], capture_output=True, text=True, timeout=15)
            result.update(validationCode=validation.returncode, validation=validation.stderr[-1600:])
        print(json.dumps(result))
        return
    names = ['hp-capstone-b-portal-portal-1'] if role == 'B' else ['hp-public-web-waf-1', 'hp-capstone-control-control-1']
    containers = json.loads(run(['docker', 'inspect', *names]))
    result = {'containers': [{'name': x['Name'], 'image': x['Image'], 'running': x['State']['Running'],
                             'health': x['State'].get('Health', {}).get('Status'),
                             'ports': x['NetworkSettings']['Ports']} for x in containers],
              'addresses': json.loads(run(['ip', '-j', 'address'])),
              'listeners': run(['ss', '-lnt']).splitlines(),
              'dockerVersion': run(['docker', 'compose', 'version', '--short']).strip(),
              'existingEntryDirectory': pathlib.Path('/opt/highpass/patient-public-entry').exists()}
    print(json.dumps(result))
