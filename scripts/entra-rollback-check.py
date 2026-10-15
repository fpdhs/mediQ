"""Isolated baseline/candidate/baseline recovery rehearsal; never targets live resources."""
import argparse, hashlib, importlib.util, json, pathlib, secrets, subprocess, time, uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
POSTGRES = 'sha256:8d0e686f1620c154c0c35ba8c7173a90f8f1a55ff8062f75677be1f3a4196568'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate'); args = parser.parse_args()
    candidate = (ROOT / args.candidate).resolve()
    assert candidate.is_relative_to((ROOT / 'artifacts/azure').resolve())
    manifest = json.loads((candidate / 'candidate.json').read_text())
    spec = importlib.util.spec_from_file_location('config', ROOT / 'scripts/entra-web-config.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    folder = module.protected_folder(); secret_dir = folder / 'ephemeral'; secret_dir.mkdir()
    stamp = 'hp-auth-recovery-' + uuid.uuid4().hex[:12]
    label = 'highpass.auth-recovery=' + stamp
    network = stamp + '-net'; db = stamp + '-db'; app = stamp + '-app'
    checks = []; owned = []; network_created = False

    def run(name, argv, timeout=90, required=True):
        started = time.monotonic()
        result = subprocess.run(argv, cwd=ROOT, capture_output=True, timeout=timeout)
        (folder / (name + '.log')).write_bytes(result.stdout + result.stderr)
        checks.append(dict(test=name, status='PASS' if result.returncode == 0 else 'FAIL',
                           exitCode=result.returncode, seconds=round(time.monotonic()-started, 3)))
        if required and result.returncode: raise RuntimeError(name)
        return result

    def remove_container(name):
        info = subprocess.run(['docker', 'inspect', name], capture_output=True, timeout=30)
        if info.returncode: return
        value = json.loads(info.stdout)[0]
        if value['Config']['Labels'].get('highpass.auth-recovery') != stamp:
            raise RuntimeError('CLEANUP_OWNER_MISMATCH')
        run('cleanup-' + name, ['docker', 'rm', '-f', '-v', name])

    try:
        for name in ['admin', 'app', 'dicom', 'jwt', 'ingress', 'data']:
            (secret_dir / name).write_text(secrets.token_hex(32))
        tenant = '11111111-1111-4111-8111-111111111111'
        mapping = dict(schemaVersion=1, tenantId=tenant, actors=[
            dict(objectId='44444444-4444-4444-8444-444444444444', actorId='synthetic-patient-hcc', role='PATIENT', patientId='MEDIQ-SYN-HCC-001'),
            dict(objectId='55555555-5555-4555-8555-555555555555', actorId='synthetic-doctor-b', role='DOCTOR', doctorId='DOC-B-01', hospitalId='HOSP-B')])
        (secret_dir / 'actors.json').write_text(json.dumps(mapping))
        mount = ['--mount', 'type=bind,source=' + str(secret_dir) + ',target=/run/check,readonly']
        run('network', ['docker', 'network', 'create', '--internal', '--label', label, network]); network_created = True
        owned.append(db)
        run('postgres-start', ['docker', 'run', '-d', '--name', db, '--label', label, '--network', network,
            '--network-alias', 'postgres', '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,size=256m',
            *mount, '-e', 'POSTGRES_USER=hipass_bootstrap', '-e', 'POSTGRES_DB=hipass',
            '-e', 'POSTGRES_PASSWORD_FILE=/run/check/admin', POSTGRES])
        ready = False
        for attempt in range(30):
            r = subprocess.run(['docker', 'exec', db, 'pg_isready', '-U', 'hipass_bootstrap', '-d', 'hipass'], capture_output=True, timeout=15)
            if r.returncode == 0: ready = True; break
            time.sleep(1)
        if not ready: raise RuntimeError('POSTGRES_NOT_READY')
        control = manifest['roles']['control']
        run('least-privilege-bootstrap', ['docker', 'run', '--rm', '--network', network, '--read-only', '--cap-drop=ALL',
            *mount, '-e', 'CAPSTONE_ADMIN_PASSWORD_FILE=/run/check/admin', '-e', 'CAPSTONE_APP_PASSWORD_FILE=/run/check/app',
            '--entrypoint=/nodejs/bin/node', control['image'], 'scripts/bootstrap-capstone-postgres.js'])
        common = dict(NODE_ENV='production', HIPASS_STORE='postgres', HIPASS_CONTROL_PLANE_ONLY='1', HIPASS_DPOP_REQUIRED='1',
            HIPASS_CAPSTONE_MOCK_IDP='0', POSTGRES_USER='hipass_app', POSTGRES_DB='hipass', POSTGRES_HOST='postgres',
            POSTGRES_PASSWORD_FILE='/run/check/app', DICOM_TOKEN_SECRET_FILE='/run/check/dicom', TEST_JWT_SECRET_FILE='/run/check/jwt',
            HIPASS_INGRESS_SECRET_FILE='/run/check/ingress', HIPASS_DATA_PLANE_SERVICE_TOKEN_FILE='/run/check/data',
            HIPASS_PUBLIC_BASE_URL='https://192.168.111.149:9443', JWT_ISSUER='highpass-capstone-test-idp', JWT_AUDIENCE='highpass-capstone-api')
        snapshots = {}
        query = "SELECT json_build_object('patients',(SELECT count(*) FROM patients),'consents',(SELECT count(*) FROM consents),'audit',(SELECT count(*) FROM audit_logs),'loginFailures',(SELECT count(*) FROM audit_logs WHERE action='LOGIN_FAILURE'))"
        for phase, image, auth in [('baseline', control['base'], 'TEST'), ('candidate', control['image'], 'ENTRA_OIDC'), ('restored', control['base'], 'TEST')]:
            env = dict(common, AUTH_MODE=auth)
            if auth == 'ENTRA_OIDC':
                env.update(ENTRA_TENANT_ID=tenant, ENTRA_SPA_CLIENT_ID='22222222-2222-4222-8222-222222222222',
                    ENTRA_API_AUDIENCE='33333333-3333-4333-8333-333333333333', ENTRA_API_SCOPE='access_as_user',
                    ENTRA_REDIRECT_URI='https://192.168.111.149:9443/entra-redirect.html', HIPASS_ENTRA_ACTOR_MAP_FILE='/run/check/actors.json')
            options = [entry for k,v in env.items() for entry in ['-e', k+'='+v]]
            if app not in owned: owned.append(app)
            run(phase+'-start', ['docker', 'run', '-d', '--name', app, '--label', label, '--network', network,
                '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', *mount, *options,
                '--entrypoint=/nodejs/bin/node', image, 'scripts/start-capstone-control.js'])
            probe = "let ready=false;for(let i=0;i<20;i++){try{let r=await fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(1500)});if(r.status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}if(!ready)process.exit(2);console.log('HEALTH_PASS')"
            run(phase+'-ready', ['docker','exec',app,'/nodejs/bin/node','--input-type=module','-e',probe],45)
            probe = "let o={};for(const p of ['/api/health','/api/capstone-demo/auth-config','/api/capstone-demo/identity']){const r=await fetch('http://127.0.0.1:3000'+p,{signal:AbortSignal.timeout(5000)});o[p]=r.status}console.log(JSON.stringify(o))"
            result = json.loads(run(phase+'-http', ['docker','exec',app,'/nodejs/bin/node','--input-type=module','-e',probe]).stdout)
            if result['/api/health'] != 200 or (auth == 'ENTRA_OIDC' and (result['/api/capstone-demo/auth-config'] != 200 or result['/api/capstone-demo/identity'] != 401)):
                raise RuntimeError('HTTP_CONTRACT_FAILED')
            actual = json.loads(run(phase+'-inspect',['docker','inspect',app]).stdout)[0]
            if actual['Image'] != image: raise RuntimeError('IMAGE_MISMATCH')
            snapshots[phase] = json.loads(run(phase+'-db', ['docker','exec',db,'psql','-U','hipass_bootstrap','-d','hipass','-Atc',query]).stdout)
            remove_container(app)
        preserved = snapshots['baseline']['patients'] == snapshots['candidate']['patients'] == snapshots['restored']['patients']
        preserved &= snapshots['baseline']['consents'] == snapshots['candidate']['consents'] == snapshots['restored']['consents']
        preserved &= snapshots['candidate']['loginFailures'] > snapshots['baseline']['loginFailures']
        preserved &= snapshots['restored']['audit'] == snapshots['candidate']['audit']
        checks.append(dict(test='database-and-auth-audit-preserved-on-rollback', status='PASS' if preserved else 'FAIL', snapshots=snapshots))
    except Exception as error:
        checks.append(dict(test='recovery',status='FAIL',reason=type(error).__name__,stage=str(error) if isinstance(error,RuntimeError) else 'COMMAND_EXCEPTION'))
    finally:
        for name in reversed(owned):
            diagnostic=subprocess.run(['docker','logs','--tail','100',name],capture_output=True,timeout=30)
            (folder/(name+'-diagnostic.log')).write_bytes(diagnostic.stdout+diagnostic.stderr)
            try: remove_container(name)
            except Exception: checks.append(dict(test='cleanup-container',status='FAIL',name=name))
        if network_created:
            try:
                info=json.loads(subprocess.check_output(['docker','network','inspect',network],timeout=30))[0]
                if info['Labels'].get('highpass.auth-recovery') != stamp: raise RuntimeError('OWNER_MISMATCH')
                run('cleanup-network',['docker','network','rm',network])
            except Exception: checks.append(dict(test='cleanup-network',status='FAIL'))
        for file in secret_dir.iterdir():
            if file.is_file() and file.parent.resolve()==secret_dir.resolve(): file.unlink()
        secret_dir.rmdir()
    result=dict(status='PASS' if checks and all(c['status']=='PASS' for c in checks) else 'FAIL',review='DRAFT / UNASSIGNED',
        scope='ISOLATED_CONTROL_POSTGRES_AUTH_ROLLBACK',liveServicesChanged=False,images=manifest['roles'],checks=checks,
        notVerified=['Live VM rollback','Real Entra browser login','Patient grant / HCC catalog / key-release overlays','B portal live TLS rollback'])
    out=folder/'rollback.json';out.write_text(json.dumps(result,indent=2))
    print(json.dumps(dict(status=result['status'],evidence=str(out),checks=checks)))
    return 0 if result['status']=='PASS' else 2

if __name__=='__main__': raise SystemExit(main())
