"""Narrow existing-container rollout. Invoked with reviewed payload, never HTTP."""
import base64
import hashlib
import json
import pathlib
import subprocess
import zlib
import re
import os

def decode(value):
    assert value.startswith('z:')
    return zlib.decompress(base64.b64decode(value[2:]))

BASE = pathlib.Path('/opt/highpass/patient-viewer-rollout-20261013')
NAMES = {'control':'hp-capstone-control-control-1','web':'hp-public-web-web-1','portal':'hp-capstone-b-portal-portal-1'}

def run(args, timeout=40, data=None):
    p = subprocess.run(args, input=data, text=True, capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('ROLLOUT_COMMAND_FAILED_' + args[0])
    return p.stdout

def inspect(name):
    return json.loads(run(['docker','inspect',name]))[0]

def save(path, value):
    path.write_text(json.dumps(value), encoding='utf8');path.chmod(0o600)

def compose(item):
    labels=item['Config']['Labels']; args=['docker','compose','--project-directory',labels['com.docker.compose.project.working_dir'], '-p',labels['com.docker.compose.project']]
    for f in labels['com.docker.compose.project.config_files'].split(','):args+=['-f',f]
    env={**os.environ,**dict(e.split('=',1) for e in item['Config']['Env'])}
    if item['Name']=='/hp-capstone-b-portal-portal-1':
        sources={str(pathlib.Path(m['Source']).parent) for m in item['Mounts'] if m['Destination'].startswith('/run/secrets/')}
        assert len(sources)==1,'B_SECRET_PATH_AMBIGUOUS'
        env['HIPASS_B_PORTAL_SECRET_DIR']=sources.pop()
        env['HIPASS_APP_IMAGE']=item['Image']
        env['HIPASS_KEY_RELEASE_VAULT_KEY_ID']=env['CAPSTONE_VAULT_KEY_ID']
    p=subprocess.run(args+['config','--format','json'],env=env,capture_output=True,text=True,timeout=20)
    if p.returncode:
        save(BASE/'compose-error.json',{'requiredVariables':re.findall(r'(?:required variable|variable) ([A-Z_0-9]+)',p.stderr),
            'errorKinds':[s for s in ['invalid interpolation','is not set','is missing','invalid spec','no such file'] if s in p.stderr],
            'availableKeyId':bool(env.get('HIPASS_KEY_RELEASE_VAULT_KEY_ID'))})
        raise RuntimeError('COMPOSE_RESOLUTION_FAILED')
    return json.loads(p.stdout)

def switch(folder, item, file):
    labels=item['Config']['Labels']
    run(['docker','compose','-p',labels['com.docker.compose.project'],'-f',str(folder/file),'up','-d','--no-deps','--pull','never',labels['com.docker.compose.service']])

def main(role, phase, payload):
    roles=['control','web'] if role=='CLOUD' else ['portal']
    if phase in ['tls-stage','tls-open','tls-close']:
        assert role=='B'
        entry=pathlib.Path('/opt/highpass/patient-public-entry'); folder=BASE/'tls'
        if phase=='tls-stage':
            folder.mkdir(mode=0o700,exist_ok=True)
            original=(entry/'Caddyfile').read_text();assert 'PATIENT_IMAGE_ENTRY_NOT_ENABLED' in original and 'reverse_proxy' not in original
            (folder/'before.Caddyfile').write_text(original)
            config=json.loads((entry/'compose.json').read_text());save(folder/'before.json',config)
            portal=inspect(NAMES['portal']);ca=next(m['Source'] for m in portal['Mounts'] if m['Destination']=='/run/secrets/ca.crt')
            certificate=pathlib.Path(ca).read_bytes();assert b'BEGIN CERTIFICATE' in certificate and b'PRIVATE KEY' not in certificate
            ca=str(entry/'b-upstream-ca.crt');pathlib.Path(ca).write_bytes(certificate);pathlib.Path(ca).chmod(0o644)
            config['services']['tls']['volumes'].append(ca+':/etc/caddy/b-ca.crt:ro')
            save(folder/'after.json',config)
            # Exact patient routes and clinician DICOM read/single-import routes; downloads and queries stay closed.
            route=r'''
 route {
  @query expression `{http.request.uri.query} != ""`
  respond @query `{"error":"PATIENT_ROUTE_NOT_ALLOWED"}` 403
  @clinician_get_preflight {
   method OPTIONS
   path_regexp clinician_get_preflight ^/dicomweb/studies($|/[0-9.]{1,64}/series($|/[0-9.]{1,64}/instances($|/[0-9.]{1,64}/rendered$)))$
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
   header Access-Control-Request-Method GET
  }
  handle @clinician_get_preflight {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   header Access-Control-Allow-Methods "GET"
   header Access-Control-Allow-Headers "authorization, dpop"
   header Access-Control-Max-Age "60"
   respond "" 204
  }
  @clinician_get {
   method GET
   path_regexp clinician_get ^/dicomweb/studies($|/[0-9.]{1,64}/series($|/[0-9.]{1,64}/instances($|/[0-9.]{1,64}/rendered$)))$
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
  }
  handle @clinician_get {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   reverse_proxy https://192.168.111.149:9443 {
    header_up -Cookie
    header_up -X-Hipass-Service-Token
    header_up -X-Hipass-Ingress-Signature
    header_up -X-Hipass-Ingress-Time
    header_down -Set-Cookie
    transport http {
     tls_trust_pool file /etc/caddy/b-ca.crt
     dial_timeout 5s
     response_header_timeout 35s
    }
   }
  }
  @clinician_import_preflight {
   method OPTIONS
   path_regexp clinician_import_preflight ^/dicomweb/studies/[0-9.]{1,64}/series/[0-9.]{1,64}/instances/[0-9.]{1,64}/import$
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
   header Access-Control-Request-Method POST
   header_regexp Access-Control-Request-Headers ^(?i:authorization,\s*dpop|dpop,\s*authorization|authorization,\s*dpop,\s*x-hipass-transfer-item-id,\s*x-hipass-transfer-job-id,\s*x-hipass-transfer-lease-id)$
  }
  handle @clinician_import_preflight {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   header Access-Control-Allow-Methods "POST"
   header Access-Control-Allow-Headers "authorization, dpop, x-hipass-transfer-item-id, x-hipass-transfer-job-id, x-hipass-transfer-lease-id"
   header Access-Control-Max-Age "60"
   respond "" 204
  }
  @clinician_import {
   method POST
   path_regexp clinician_import ^/dicomweb/studies/[0-9.]{1,64}/series/[0-9.]{1,64}/instances/[0-9.]{1,64}/import$
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
  }
  handle @clinician_import {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   reverse_proxy https://192.168.111.149:9443 {
    header_up -Cookie
    header_up -X-Hipass-Service-Token
    header_up -X-Hipass-Ingress-Signature
    header_up -X-Hipass-Ingress-Time
    header_down -Set-Cookie
    header_down -Access-Control-Allow-Origin
    transport http {
     tls_trust_pool file /etc/caddy/b-ca.crt
     dial_timeout 5s
     response_header_timeout 60s
    }
   }
  }
  @preflight {
   method OPTIONS
   path_regexp preflight ^/patient-dicomweb/studies/[0-9.]{1,64}/series/[0-9.]{1,64}/instances(/[0-9.]{1,64}/rendered)?$
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
   header Access-Control-Request-Method GET
  }
  handle @preflight {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   header Access-Control-Allow-Methods "GET"
   header Access-Control-Allow-Headers "authorization, dpop"
   header Access-Control-Max-Age "60"
   respond "" 204
  }
  @image {
   method GET
   path_regexp image ^/patient-dicomweb/studies/[0-9.]{1,64}/series/[0-9.]{1,64}/instances(/[0-9.]{1,64}/rendered)?$
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
  }
  handle @image {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   reverse_proxy https://192.168.111.149:9443 {
    header_up -Cookie
    header_up -X-Hipass-Service-Token
    header_up -X-Hipass-Ingress-Signature
    header_up -X-Hipass-Ingress-Time
    header_down -Set-Cookie
    transport http {
     tls_trust_pool file /etc/caddy/b-ca.crt
     dial_timeout 5s
     response_header_timeout 35s
    }
   }
  }
  respond `{"error":"PATIENT_ROUTE_NOT_ALLOWED"}` 403
 }
'''
            candidate=original.replace('  Content-Type "application/json"\n','  Referrer-Policy "no-referrer"\n  Vary "Origin"\n').replace('   write 10s','   write 65s')
            old=' respond `{"error":"PATIENT_IMAGE_ENTRY_NOT_ENABLED"}` 403\n';assert candidate.count(old)==1
            candidate=candidate.replace(old,route);(folder/'after.Caddyfile').write_text(candidate)
            validation=subprocess.run(['docker','run','--rm','--network=none','--read-only','--tmpfs','/tmp','-v',str(folder/'after.Caddyfile')+':/etc/caddy/Caddyfile:ro','-v',ca+':/etc/caddy/b-ca.crt:ro',config['services']['tls']['image'],'caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],capture_output=True,text=True,timeout=30)
            if validation.returncode:return {'status':'FAIL','validation':validation.stderr[-3000:],'publicRoutes':'STILL_CLOSED'}
            return {'status':'PASS','publicRoutes':'STILL_CLOSED','candidateSha256':hashlib.sha256(candidate.encode()).hexdigest()}
        before=phase=='tls-close'
        (entry/'Caddyfile').write_text((folder/('before.Caddyfile' if before else 'after.Caddyfile')).read_text())
        save(entry/'compose.json',json.loads((folder/('before.json' if before else 'after.json')).read_text()))
        run(['systemctl','restart','hp-patient-public-tls.service'])
        return {'status':'PASS','routes':'DENY_ALL' if before else 'SCOPED_PATIENT_AUTHORIZATION_REQUIRED'}
    if phase=='probe':
        if (BASE/'portal/build.log').exists():return {'buildTail':(BASE/'portal/build.log').read_text()[-2500:]}
        output={}
        for part in roles:
            item=inspect(NAMES[part]); labels=item['Config']['Labels']
            output[part]={'workdir':labels.get('com.docker.compose.project.working_dir'),
                'files':{f:pathlib.Path(f).exists() for f in labels.get('com.docker.compose.project.config_files','').split(',')},
                'candidateFiles':[p.name for p in (BASE/part).iterdir()] if (BASE/part).exists() else []}
            if (BASE/part/'before.json').exists():
                output[part]={'unresolvedVariables':sorted(set(re.findall(r'\$\{([^}]+)\}',(BASE/part/'before.json').read_text()))),
                    'mounts':[{'target':m['Destination'],'sourceParent':str(pathlib.Path(m['Source']).parent)} for m in item['Mounts']],
                    'disk':run(['df','-h','/var/lib/docker']), 'candidateExists':subprocess.run(['docker','image','inspect','highpass-patient-viewer:'+part+'-20261013'],capture_output=True,timeout=10).returncode==0}
        return output
    if phase=='capture':
        output={}
        for part in roles:
            item=inspect(NAMES[part]); assert item['State']['Running']
            names=payload[part]
            js="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.existsSync('/app/'+p)?fs.readFileSync('/app/'+p).toString('base64'):null]))))"
            files=json.loads(run(['docker','exec',item['Id'],'/nodejs/bin/node','-e',js,json.dumps(names)]))
            output[part]={'id':item['Id'],'image':item['Image'],'files':files}
        return output
    if phase=='stage':
        BASE.mkdir(mode=0o700,exist_ok=True)
        output={}
        for part in roles:
            p=payload[part]; item=inspect(NAMES[part]);assert item['Image']==p['image']
            folder=BASE/part
            restage=folder.exists() and (folder/'candidate.json').exists()
            if restage:
                assert role=='CLOUD','EXISTING_CANDIDATE_PRESERVED'
                assert item['Image']==json.loads((folder/'baseline.json').read_text())['Image']
                previous=json.loads((folder/'candidate.json').read_text());save(folder/('candidate-'+previous['image'][7:23]+'.json'),previous)
            elif folder.exists():assert part=='portal','EXISTING_CANDIDATE_PRESERVED'
            else:folder.mkdir(mode=0o700)
            if restage:config=json.loads((folder/'before.json').read_text())
            else:save(folder/'baseline.json',item); config=compose(item);save(folder/'before.json',config)
            for name,encoded in p['files'].items():
                assert name.startswith(('src/','public/','scripts/')) and '..' not in name
                target=folder/name;target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(decode(encoded));target.chmod(0o644)
            base='highpass-viewer-base:'+item['Image'][7:23];run(['docker','tag',item['Image'],base])
            (folder/'Dockerfile').write_text('FROM '+base+'\n'+''.join('COPY '+name+' /app/'+name+'\n' for name in p['files']))
            (folder/'.dockerignore').write_text('*\n!Dockerfile\n!src/\n!src/**\n!scripts/\n!scripts/**\n!public/\n!public/**\n')
            tag='highpass-patient-viewer:'+part+'-20261013'
            if part=='portal':
                built=subprocess.run(['docker','image','inspect',tag],capture_output=True,timeout=10).returncode==0
                if not built:
                    if (folder/'build.pid').exists():
                        pid=int((folder/'build.pid').read_text())
                        if pathlib.Path('/proc/'+str(pid)).exists():return {'portal':{'status':'BUILD_RUNNING'}}
                    with (folder/'build.log').open('w') as log:
                        job=subprocess.Popen(['docker','build','--network=none','--pull=false','-t',tag,str(folder)],stdout=log,stderr=log,start_new_session=True)
                    (folder/'build.pid').write_text(str(job.pid));return {'portal':{'status':'BUILD_STARTED'}}
            else:run(['docker','build','--network=none','--pull=false','-t',tag,str(folder)],timeout=50)
            image=inspect(tag);assert image['Config']==inspect(item['Image'])['Config']
            for name in p['files']:
                if name.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',image['Id'],'--check','/app/'+name])
            service=item['Config']['Labels']['com.docker.compose.service']; conf=config['services'][service]
            conf['environment']={k:v.replace('$','$$') for k,v in (e.split('=',1) for e in item['Config']['Env'])}
            conf['image']=image['Id']
            if part=='control':conf['environment'].update(HIPASS_PATIENT_ISSUANCE_ORIGIN='https://highpass-demo.japaneast.cloudapp.azure.com',HIPASS_PATIENT_IMAGE_ORIGIN='https://highpass-images-b.japaneast.cloudapp.azure.com')
            if part=='portal':
                conf['environment']['HIPASS_PATIENT_IMAGE_ORIGIN']='https://highpass-images-b.japaneast.cloudapp.azure.com'
                if conf['environment'].get('CAPSTONE_B_PACS_IMPORT_ENABLED')=='1':
                    conf['environment']['CAPSTONE_B_IMPORT_BROWSER_ORIGIN']='https://highpass-demo.japaneast.cloudapp.azure.com'
            if part=='web':
                mounts=[v for v in conf.get('volumes',[]) if v.get('target')=='/app/scripts/start-public-web.js']
                assert len(mounts)==1 and mounts[0]['read_only'];mounts[0]['source']=str(folder/'scripts/start-public-web.js')
                # Only this script must be traversable by the non-root container.
                BASE.chmod(0o711);folder.chmod(0o711);(folder/'scripts').chmod(0o755)
            save(folder/'after.json',config);save(folder/'candidate.json',{'image':image['Id'],'hashes':{k:hashlib.sha256(decode(v)).hexdigest() for k,v in p['files'].items()}})
            output[part]={'image':image['Id'],'status':'PASS'}
        return output
    if phase=='migrate':
        assert role=='CLOUD'
        sql=base64.b64decode(payload['migration']).decode()
        assert sql.startswith('-- Explicit operator migration;')
        # Bounded additive DDL; legacy rows and ownership remain untouched.
        run(['docker','exec','-i','hp-capstone-control-postgres-1','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','hipass_bootstrap','-d','hipass'],
            data="BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='5s';\n"+sql+'\nCOMMIT;')
        save(BASE/'migration038.json',{'applied':True,'sha256':hashlib.sha256(sql.encode()).hexdigest()})
        return {'status':'PASS','migration':'038','rollback':'retain additive column; roll back application'}
    if phase in ['deploy','rollback']:
        output={}
        for part in roles:
            folder=BASE/part; old=json.loads((folder/'baseline.json').read_text());candidate=json.loads((folder/'candidate.json').read_text())
            current=inspect(NAMES[part]);assert current['Image'] in [old['Image'],candidate['image']]
            try:
                switch(folder,old,'after.json' if phase=='deploy' else 'before.json')
                current=inspect(NAMES[part]);assert current['State']['Running']
                assert current['Image']==(candidate['image'] if phase=='deploy' else old['Image'])
                for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:assert current['HostConfig'][key]==old['HostConfig'][key]
                assert set(current['NetworkSettings']['Networks'])==set(old['NetworkSettings']['Networks'])
                def mounts(value):
                    return sorted((m['Type'],m['Source'],m['Destination'],m['RW']) for m in value['Mounts'] if not (part=='web' and m['Destination']=='/app/scripts/start-public-web.js'))
                assert mounts(current)==mounts(old),'MOUNT_DRIFT'
                before_env=dict(e.split('=',1) for e in old['Config']['Env'])
                after_env=dict(e.split('=',1) for e in current['Config']['Env'])
                allowed={'HIPASS_PATIENT_IMAGE_ORIGIN','HIPASS_PATIENT_ISSUANCE_ORIGIN'}
                assert {k:v for k,v in before_env.items() if k not in allowed}=={k:v for k,v in after_env.items() if k not in allowed},'ENVIRONMENT_DRIFT'
            except Exception:
                switch(folder,old,'before.json');raise
            output[part]={'status':'PASS','image':current['Image'],'health':current['State'].get('Health',{}).get('Status')}
        return output
    if phase=='verify':
        return {part:{'image':inspect(NAMES[part])['Image'],'running':inspect(NAMES[part])['State']['Running'],
            'health':inspect(NAMES[part])['State'].get('Health',{}).get('Status')} for part in roles}
    raise RuntimeError('UNKNOWN_PHASE')
