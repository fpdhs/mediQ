"""Bounded guest operator, invoked over the pinned SSH channel by release.py."""
import base64
import copy
import hashlib
import json
import os
import pathlib
import subprocess
import time

folder = pathlib.Path(MANIFEST['stage'])
assert str(folder).startswith('/opt/highpass/security-release-')
names = {'control': 'hp-capstone-control-control-1', 'web': 'hp-public-web-web-1'}


def run(args, timeout=120, env=None):
    result = subprocess.run(args, capture_output=True, timeout=timeout, env=env)
    if result.returncode:
        log = folder / (PHASE + '-error.log')
        log.write_bytes(result.stdout + result.stderr)
        log.chmod(0o600)
        raise RuntimeError('SECURITY_COMMAND_FAILED_' + args[0])
    return result.stdout


def inspect(name):
    return json.loads(run(['docker', 'inspect', name]))[0]


def save(path, value):
    path.write_text(json.dumps(value))
    path.chmod(0o600)


def env_for(item):
    return dict(x.split('=', 1) for x in item['Config']['Env'])


def assert_baseline():
    for expected in MANIFEST['baseline']:
        actual = inspect(expected['name'])
        assert actual['Id'] == expected['id'] and actual['Image'] == expected['image'], 'SECURITY_BASELINE_CHANGED'
        assert actual['State']['Running'], 'SECURITY_BASELINE_NOT_RUNNING'
    assert hashlib.sha256(pathlib.Path(MANIFEST['startupPath']).read_bytes()).hexdigest() == MANIFEST['startupBeforeHash'], 'PUBLIC_STARTUP_CHANGED'


def config_for(old, project):
    labels = old['Config']['Labels']
    cmd = ['docker', 'compose', '--project-directory', labels['com.docker.compose.project.working_dir'], '-p', project]
    for file in labels['com.docker.compose.project.config_files'].split(','):
        cmd += ['-f', file]
    actual = env_for(old)
    environment = {**os.environ, **actual, 'HIPASS_APP_IMAGE': old['Image'],
                   'HIPASS_POSTGRES_IMAGE': inspect('hp-capstone-control-postgres-1')['Image'],
                   'HIPASS_CLOUD_SECRET_DIR': '/opt/highpass/capstone-control-secrets',
                   'HIPASS_CAPSTONE_PUBLIC_ORIGIN': 'https://192.168.111.149:9443'}
    config = json.loads(run(cmd + ['config', '--format', 'json'], env=environment))
    service = 'web' if project == 'hp-public-web' else 'control'
    assert config['services'][service]['image'] == old['Image'], 'COMPOSE_IMAGE_DRIFT'
    config['services'][service]['environment'] = {k: v.replace('$', '$$') for k, v in actual.items()}
    return config


def switch(role, suffix):
    run(['docker', 'compose', '-p', 'hp-public-web' if role == 'web' else 'hp-capstone-control',
         '-f', str(folder / (role + '-' + suffix + '.json')), 'up', '-d', '--no-deps', '--pull', 'never', role])
    for attempt in range(45):
        item = inspect(names[role])
        if item['State']['Running']:
            if role == 'control' and item['State'].get('Health', {}).get('Status') == 'healthy':
                return item
            if role == 'web':
                probe = subprocess.run(['docker', 'exec', item['Id'], '/nodejs/bin/node', '-e',
                    "fetch('http://127.0.0.1:8080/',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(2))"],
                    capture_output=True, timeout=4)
                if probe.returncode == 0:
                    return item
        time.sleep(1)
    raise RuntimeError('SECURITY_DEPLOYMENT_UNHEALTHY')


if PHASE == 'build':
    assert_baseline()
    candidates = {}
    for role, data in MANIFEST['roles'].items():
        for path, expected in data['hashes'].items():
            assert hashlib.sha256((folder / role / path).read_bytes()).hexdigest() == expected
        tag = 'highpass-security-' + role + ':' + MANIFEST['operation']
        base_tag = 'highpass-security-base:' + data['base'][7:23]
        run(['docker', 'tag', data['base'], base_tag])
        run(['chmod', '-R', 'a+rX', str(folder / role)])
        (folder / role / 'Dockerfile').write_text('FROM ' + base_tag + '\n' + ''.join(
            'COPY --chmod=755 ' + p + ' /app/' + p + '\n' for p in data['hashes']))
        run(['docker', 'build', '--network=none', '--pull=false', '-t', tag, str(folder / role)], 300)
        image, base = inspect(tag), inspect(data['base'])
        assert image['Config'] == base['Config'], 'IMAGE_CONFIG_CHANGED'
        assert image['RootFS']['Layers'][:len(base['RootFS']['Layers'])] == base['RootFS']['Layers'], 'BASE_IMAGE_CHANGED'
        for path in data['hashes']:
            if path.endswith('.js'):
                run(['docker', 'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
                     '--entrypoint=/nodejs/bin/node', image['Id'], '--check', '/app/' + path])
        candidates[role] = image['Id']
    folder.chmod(0o711)
    run(['chmod', '-R', 'a+rX', str(folder / 'checks')])
    actors = folder / 'actors.json'
    assert hashlib.sha256(actors.read_bytes()).hexdigest() == MANIFEST['actorMapHash'], 'ACTOR_MAPPING_CHANGED'
    assert inspect(names['control'])['Config']['User'] in ['65532', '65532:65532'], 'EXPECTED_NONROOT_RUNTIME_REQUIRED'
    actors.chmod(0o440)
    os.chown(actors, 0, 65532)
    validate = "const fs=await import('node:fs');const a=await import('/app/src/auth.js');const m=JSON.parse(fs.readFileSync('/run/security-actors/actors.json','utf8'));a.validateSyntheticActorMap(m,m.tenantId);console.log(JSON.stringify({roles:m.actors.map(a=>a.role)}))"
    mapping = json.loads(run(['docker', 'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
         '-v', str(actors) + ':/run/security-actors/actors.json:ro', '--entrypoint=/nodejs/bin/node', candidates['control'],
         '--input-type=module', '-e', validate]))
    assert set(mapping['roles']) == {'PATIENT', 'DOCTOR', 'SECURITY_ADMIN'}
    test_cmd = ['docker', 'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
                '--security-opt=no-new-privileges:true', '--tmpfs=/tmp:rw,nosuid,noexec,size=32m',
                '-v', str(folder / 'checks/scripts/test-support/isolated-server.js') + ':/app/scripts/test-support/isolated-server.js:ro']
    for path in MANIFEST['tests']:
        test_cmd += ['-v', str(folder / 'checks' / path) + ':/app/' + path + ':ro']
    public_snapshot = folder / ('test-public-' + str(time.time_ns()))
    test_container = run(['docker', 'create', candidates['web']]).decode().strip()
    try:
        run(['docker', 'cp', test_container + ':/app/public', str(public_snapshot)])
    finally:
        run(['docker', 'rm', test_container])
    run(['chmod', '-R', 'a+rX', str(public_snapshot)])
    test_cmd += ['-v', str(public_snapshot) + ':/app/public:ro']
    test_cmd += ['--entrypoint=/nodejs/bin/node', candidates['control'], '--test'] + ['/app/' + p for p in MANIFEST['tests']]
    output = run(test_cmd, 120)
    (folder / 'candidate-tests.log').write_bytes(output)
    (folder / 'candidate-tests.log').chmod(0o600)
    print(json.dumps({'status': 'PASS', 'images': candidates, 'mappingRoles': mapping['roles'], 'tests': MANIFEST['tests']}))

elif PHASE == 'deploy':
    assert_baseline()
    assert hashlib.sha256((folder / 'actors.json').read_bytes()).hexdigest() == MANIFEST['actorMapHash'], 'ACTOR_MAPPING_CHANGED'
    old = {role: inspect(name) for role, name in names.items()}
    for role in names:
        configuration = config_for(old[role], 'hp-public-web' if role == 'web' else 'hp-capstone-control')
        save(folder / (role + '-before.json'), configuration)
        configuration = copy.deepcopy(configuration)
        service = configuration['services'][role]
        service['image'] = MANIFEST['candidates'][role]
        if role == 'control':
            service['environment'].update(HIPASS_ENTRA_ACTOR_MAP_FILE='/run/security-actors/actors.json',
                HIPASS_AZURE_AUDIT_MI_ENABLED='1', HIPASS_AUDIT_WORKSPACE_ID=MANIFEST['workspaceId'])
            service.setdefault('volumes', []).append({'type': 'bind', 'source': str(folder / 'actors.json'),
                'target': '/run/security-actors/actors.json', 'read_only': True, 'bind': {'create_host_path': False}})
        save(folder / (role + '-after.json'), configuration)
    startup = pathlib.Path(MANIFEST['startupPath'])
    original = startup.read_bytes()
    (folder / 'start-public-web.before.js').write_bytes(original)
    (folder / 'start-public-web.before.js').chmod(0o600)
    candidate = (folder / 'start-public-web.after.js').read_bytes()
    assert hashlib.sha256(candidate).hexdigest() == MANIFEST['startupAfterHash']
    changed = []
    try:
        for role in ['control', 'web']:
            changed.append(role)
            if role == 'web':
                startup.write_bytes(candidate)
            current = switch(role, 'after')
            assert current['Image'] == MANIFEST['candidates'][role]
            for key in ['User', 'Entrypoint', 'Cmd']:
                assert current['Config'][key] == old[role]['Config'][key], 'RUNTIME_CONFIG_CHANGED'
            for key in ['PortBindings', 'ReadonlyRootfs', 'CapDrop', 'SecurityOpt']:
                assert current['HostConfig'][key] == old[role]['HostConfig'][key], 'SECURITY_SETTINGS_CHANGED'
            expected_env = env_for(old[role])
            if role == 'control':
                expected_env.update(HIPASS_ENTRA_ACTOR_MAP_FILE='/run/security-actors/actors.json',
                    HIPASS_AZURE_AUDIT_MI_ENABLED='1', HIPASS_AUDIT_WORKSPACE_ID=MANIFEST['workspaceId'])
            assert env_for(current) == expected_env, 'ENVIRONMENT_DRIFT'
            for mount in old[role]['Mounts']:
                assert mount in current['Mounts'], 'EXISTING_MOUNT_CHANGED'
            assert len(current['Mounts']) == len(old[role]['Mounts']) + (1 if role == 'control' else 0), 'UNEXPECTED_MOUNT'
        for expected in MANIFEST['baseline'][2:]:
            assert inspect(expected['name'])['Id'] == expected['id'], 'PROTECTED_CONTAINER_CHANGED'
    except Exception:
        startup.write_bytes(original)
        for role in reversed(changed):
            switch(role, 'before')
        raise
    print(json.dumps({'status': 'PASS', 'images': MANIFEST['candidates'], 'mapApplied': True,
                     'publicRoutes': ['GET /api/security/overview', 'POST /api/security/reviews'],
                     'protectedContainersUnchanged': True}))

elif PHASE == 'rollback':
    for role in names:
        assert inspect(names[role])['Image'] == MANIFEST['candidates'][role], 'ROLLBACK_BASELINE_CHANGED'
    startup = pathlib.Path(MANIFEST['startupPath'])
    assert hashlib.sha256(startup.read_bytes()).hexdigest() == MANIFEST['startupAfterHash']
    startup.write_bytes((folder / 'start-public-web.before.js').read_bytes())
    for role in ['web', 'control']:
        restored = switch(role, 'before')
        assert restored['Image'] == MANIFEST['roles'][role]['base'], 'ROLLBACK_IMAGE_MISMATCH'
    print(json.dumps({'status': 'PASS', 'restored': {r: inspect(n)['Image'] for r, n in names.items()}}))

elif PHASE == 'verify':
    control = inspect(names['control'])
    web = inspect(names['web'])
    assert control['Image'] == MANIFEST['candidates']['control'] and web['Image'] == MANIFEST['candidates']['web']
    code = "const fs=await import('node:fs');const c=await import('node:crypto');const a=await import('/app/src/auth.js');const bytes=fs.readFileSync(process.env.HIPASS_ENTRA_ACTOR_MAP_FILE);const m=JSON.parse(bytes);const roles=a.validateSyntheticActorMap(m,process.env.ENTRA_TENANT_ID).values();console.log(JSON.stringify({roles:[...roles].map(a=>a.role),sha256:c.createHash('sha256').update(bytes).digest('hex'),patientContextOnSecurity:m.actors.filter(a=>a.role==='SECURITY_ADMIN').some(a=>a.patientId||a.hospitalId)}))"
    mapping = json.loads(run(['docker', 'exec', control['Id'], '/nodejs/bin/node', '--input-type=module', '-e', code]))
    assert set(mapping['roles']) == {'PATIENT', 'DOCTOR', 'SECURITY_ADMIN'} and not mapping['patientContextOnSecurity']
    assert mapping['sha256'] == MANIFEST['actorMapHash'], 'DEPLOYED_ACCOUNT_MAPPING_MISMATCH'
    azure = json.loads(run(['docker', 'exec', control['Id'], '/nodejs/bin/node', '--input-type=module', '-e',
        "const a=await import('/app/src/azure-keyvault-audit.js');const r=await a.listAzureKeyVaultAudit();console.log(JSON.stringify({status:r.status,reason:r.reason,count:r.events.length,windowHours:r.windowHours}))"], 25))
    hashes = {}
    for role, data in MANIFEST['roles'].items():
        script = "const fs=require('fs'),c=require('crypto');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,c.createHash('sha256').update(fs.readFileSync('/app/'+p)).digest('hex')]))))"
        actual = json.loads(run(['docker', 'exec', names[role], '/nodejs/bin/node', '-e', script, json.dumps(list(data['hashes']))]))
        assert actual == data['hashes'], 'DEPLOYED_SOURCE_HASH_MISMATCH'
        hashes[role] = len(actual)
    for expected in MANIFEST['baseline'][2:]:
        assert inspect(expected['name'])['Id'] == expected['id'], 'PROTECTED_CONTAINER_CHANGED'
    print(json.dumps({'status': 'PASS', 'mappedRoles': mapping['roles'], 'sourceFilesVerified': hashes,
                     'azureKeyVault': azure, 'realMicrosoftBrowserLogin': 'NOT VERIFIED'}))
else:
    raise ValueError('UNKNOWN_SECURITY_RELEASE_PHASE')
