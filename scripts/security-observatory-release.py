"""Release the security login/observatory over the captured live images only.

Identity configuration and captured sources are stored in ignored, ACL-protected
artifacts. No credentials, tokens, or complete container environments are printed.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import pathlib
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
ORIGIN = 'https://highpass-demo.japaneast.cloudapp.azure.com'
SECURITY_EMAIL = 'sureasdufo3@gmail.com'
RG = 'rg-highpass-capstone-20261008'


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runtime = load('security_runtime', 'scripts/health-helper-runtime-check.py')
config = load('security_config', 'scripts/entra-web-config.py')
identity = load('security_identity', 'scripts/capstone-key-identities.py')
gateway = load('security_gateway', 'scripts/capstone-a-gateway-ops.py')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def graph(path):
    return identity.azure('rest', '--method', 'get', '--url', 'https://graph.microsoft.com/v1.0/' + path)


def once(source, old, new):
    if source.count(old) != 1:
        raise RuntimeError('SECURITY_PATCH_ANCHOR_CHANGED')
    return source.replace(old, new, 1)


def span(source, start, end):
    if source.count(start) != 1 or source.count(end) != 1:
        raise RuntimeError('SECURITY_PATCH_SPAN_CHANGED')
    return source[source.index(start):source.index(end)]


def checked_folder(value):
    folder = pathlib.Path(value).resolve()
    if not folder.is_relative_to((ROOT / 'artifacts/azure').resolve()):
        raise RuntimeError('PROTECTED_RELEASE_FOLDER_REQUIRED')
    return folder


def prepare(folder):
    baseline = json.loads((folder / 'baseline.json').read_text(encoding='utf8'))
    ident = json.loads((folder / 'identity.json').read_text(encoding='utf8'))
    def captured(role, path):
        return (folder / 'capture' / role / path).read_text(encoding='utf8').replace('\r\n', '\n')
    def local(path):
        return (ROOT / path).read_text(encoding='utf8').replace('\r\n', '\n')
    patches = {'control': {}, 'web': {}}
    auth = captured('control', 'src/auth.js')
    start, end = 'export function validateSyntheticActorMap(', 'function readSyntheticActorMap('
    auth = once(auth, span(auth, start, end), span(local('src/auth.js'), start, end))
    patches['control']['src/auth.js'] = auth.encode()
    server = captured('control', 'src/server.js')
    server = once(server, 'const port = Number(process.env.PORT ?? 3000);',
                  "import { findAzureKeyVaultAuditEvent, listAzureKeyVaultAudit } from './azure-keyvault-audit.js';\n"
                  "import { toSecurityAuditView } from './security-observatory-view.js';\n\nconst port = Number(process.env.PORT ?? 3000);")
    start = '  if (method === "GET" && url.pathname === "/api/capstone-demo/identity") {'
    end = "  if (method === 'GET' && url.pathname === '/api/capstone-demo/scenario') {"
    server = once(server, span(server, start, end), span(local('src/server.js'), start, end))
    start = '  if (method === "GET" && url.pathname === "/api/security/overview") {'
    end = '  if (method === "GET" && url.pathname === "/api/audit-logs") {'
    server = once(server, end, span(local('src/server.js'), start, end) + end)
    start, end = 'async function requireSecurityObservatoryPrincipal(', 'function principalActorId('
    server = once(server, end, span(local('src/server.js'), start, end) + end)
    patches['control']['src/server.js'] = server.encode()
    for path in ['src/azure-keyvault-audit.js', 'src/security-observatory-view.js']:
        patches['control'][path] = (ROOT / path).read_bytes()
    app = captured('web', 'public/app.js')
    anchor = "import {renderSecurityTimeline} from '/ui/security-timeline.js';"
    app = once(app, anchor, anchor + "\nimport { loginHomePath } from '/login-navigation.js';")
    anchor = "  } else if (capstoneAuth?.context.entryRole === 'DOCTOR'"
    app = once(app, anchor, "  } else if (capstoneAuth?.roles?.length === 1 && capstoneAuth.roles[0] === 'SECURITY_ADMIN') {\n"
               "    switchPersona('DOCTOR', false);\n    navigateHospitalScreen('audit');\n" + anchor)
    start, end = 'function switchPersona(', '// Backwards-compatible Role activation helper'
    app = once(app, span(app, start, end), span(local('public/app.js'), start, end))
    anchor = 'function navigateHospitalScreen(screen) {'
    app = once(app, anchor, anchor + "\n  if (capstoneAuth?.roles?.length === 1 && capstoneAuth.roles[0] === 'SECURITY_ADMIN' && screen !== 'audit') return;")
    old_meta = re.findall(r'^    audit:.*$', app, re.M)
    new_meta = re.findall(r'^    audit:.*$', local('public/app.js'), re.M)
    if len(old_meta) != 1 or len(new_meta) != 1:
        raise RuntimeError('AUDIT_NAVIGATION_ANCHOR_CHANGED')
    app = once(app, old_meta[0], new_meta[0])
    anchor = "  if(currentPersona==='DOCTOR'&&typeof location!=='undefined'&&location.hostname==='highpass-demo.japaneast.cloudapp.azure.com'){"
    start = "  if (currentPersona === 'DOCTOR' && capstoneAuth?.roles?.includes('SECURITY_ADMIN')"
    app = once(app, anchor, span(local('public/app.js'), start, anchor) + anchor)
    start, end = 'async function loadAuditTimeline() {', 'function renderAuditTable('
    app = once(app, span(app, start, end), span(local('public/app.js'), start, end))
    start, end = 'async function fetchJson(', 'let proofKeyPromise;'
    app = once(app, span(app, start, end), span(local('public/app.js'), start, end))
    patches['web']['public/app.js'] = app.encode()
    html = captured('web', 'public/index.html')
    html = once(html, '</head>', '  <link rel="stylesheet" href="/ui/security-observatory.css">\n</head>')
    start, end = '<!-- 2.4 Audit & Provenance -->', '<section id="security-timeline"'
    html = once(html, span(html, start, end), span(local('public/index.html'), start, end))
    html = once(html, '<strong>보안 타임라인</strong><small>실제 기록 · 허용과 거부의 이유</small>',
                '<strong>보안 관제실</strong><small>앱 기록 · Azure Key Vault 활동 · 검토 흔적</small>')
    html = once(html, '<span></span> 감사 이력</button>', '<span></span> 보안 관제실</button>')
    html = html.replace('보안 타임라인에서 확인', '보안 관제실에서 확인')
    pattern = r'<details class="audit-integrity">[\s\S]*?</details>'
    old = re.findall(pattern, html)
    new = re.findall(pattern, local('public/index.html'))
    if len(old) != 1 or len(new) != 1:
        raise RuntimeError('AUDIT_INTEGRITY_ANCHOR_CHANGED')
    html = once(html, old[0], new[0])
    patches['web']['public/index.html'] = html.encode()
    css = local('public/ui/clinician-demo-tools.css')
    patches['web']['public/ui/security-observatory.css'] = css[css.index('/* Cross-source security observatory:'):].encode()
    for path in ['public/capstone-auth.js', 'public/entra-auth.js', 'public/login-navigation.js',
                 'public/ui/demo-entry.js', 'public/ui/demo-entry.css', 'public/ui/capstone-login.css']:
        patches['web'][path] = (ROOT / path).read_bytes()
    sw = captured('web', 'public/mobile/sw.js')
    sw, count = re.subn(r'const CACHE_NAME = "hipass-mediq-shell-[^"]+";',
                       'const CACHE_NAME = "hipass-mediq-shell-security-20261014";', sw)
    if count != 1:
        raise RuntimeError('MOBILE_CACHE_ANCHOR_CHANGED')
    patches['web']['public/mobile/sw.js'] = sw.encode()
    startup = (folder / 'start-public-web.before.js').read_text(encoding='utf8')
    startup = once(startup, 'const routes=[', "const routes=[\n ['GET',/^\\/api\\/security\\/overview$/],\n ['POST',/^\\/api\\/security\\/reviews$/],")
    mapping = baseline['mapping']['map']
    if any(x['role'] == 'SECURITY_ADMIN' for x in mapping['actors']) or ident['securityObjectId'] in [x['objectId'] for x in mapping['actors']]:
        raise RuntimeError('SECURITY_MAPPING_BASELINE_CHANGED')
    mapping['actors'].append({'objectId': ident['securityObjectId'], 'actorId': 'synthetic-security-auditor', 'role': 'SECURITY_ADMIN'})
    operation = uuid.uuid4().hex
    remote = '/opt/highpass/security-release-' + operation
    tests = ['test/entra-oidc-auth.test.js', 'test/entra-browser-auth.test.js', 'test/entra-redirect-login.test.js',
             'test/login-navigation.test.js', 'test/security-observatory-view.test.js', 'test/security-observatory-http.test.js',
             'test/azure-keyvault-audit.test.js', 'scripts/test-support/isolated-server.js']
    manifest = {'operation': operation, 'stage': remote, 'baseline': baseline['containers'], 'roles': {},
                'actorMapPath': baseline['mapping']['path'], 'workspaceId': ident['workspaceId'],
                'startupPath': baseline['startupPath'], 'startupBeforeHash': digest(base64.b64decode(baseline['startup'])),
                'startupAfterHash': digest(startup.encode()), 'tests': [x for x in tests if x.startswith('test/')]}
    uploads = {'actors.json': json.dumps(mapping).encode(), 'start-public-web.after.js': startup.encode()}
    for role, files in patches.items():
        manifest['roles'][role] = {'base': baseline['containers'][0 if role == 'control' else 1]['image'],
                                   'hashes': {path: digest(data) for path, data in files.items()}}
        uploads.update({role + '/' + path: data for path, data in files.items()})
    uploads.update({'checks/' + path: (ROOT / path).read_bytes() for path in tests})
    client = runtime.connect('CLOUD', None)
    try:
        runtime.remote(client, 'CLOUD', None, 'import pathlib,json; pathlib.Path(' + repr(remote) + ').mkdir(mode=0o700); print(json.dumps({"status":"PASS"}))')
        with gateway.root_sftp(client, None) as sftp:
            for path, data in uploads.items():
                destination = folder / 'candidate' / path
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
                for parent in reversed(pathlib.PurePosixPath(path).parents):
                    if str(parent) == '.':
                        continue
                    try:
                        sftp.mkdir(remote + '/' + parent.as_posix(), 0o700)
                    except OSError:
                        pass
                sftp.put(str(destination), remote + '/' + path)
                sftp.chmod(remote + '/' + path, 0o600)
        (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
        return {'status': 'PASS', 'phase': 'prepare', 'stage': remote, 'changedFiles': {role: list(files) for role, files in patches.items()}}
    finally:
        client.close()


def stage():
    folder = config.protected_folder()
    account = identity.azure('account', 'show', '--query', '{id:id,tenant:tenantId}')
    if account['id'] != config.SUB or account['tenant'] != config.TENANT:
        raise RuntimeError('APPROVED_TENANT_REQUIRED')
    users = graph("users?$filter=mail eq '" + SECURITY_EMAIL + "'&$select=id,mail,userType,externalUserState")['value']
    if len(users) != 1 or users[0].get('userType') != 'Guest' or users[0].get('externalUserState') != 'Accepted':
        raise RuntimeError('ACCEPTED_SECURITY_GUEST_REQUIRED')
    security_id = users[0]['id']
    workspace = identity.azure('monitor', 'log-analytics', 'workspace', 'show', '-g', RG,
                               '-n', 'law-highpass-key-audit-20261013', '--query', '{id:id,customerId:customerId}')
    vm = identity.azure('vm', 'show', '-g', RG, '-n', 'vm-highpass-capstone', '--query', '{identity:identity}')
    principal = vm['identity']['principalId']
    assignments = identity.azure('role', 'assignment', 'list', '--assignee', principal, '--scope', workspace['id'])
    if not any(x['roleDefinitionName'] == 'Log Analytics Reader' and x['scope'].lower() == workspace['id'].lower()
               and x['principalId'].lower() == principal.lower() for x in assignments):
        raise RuntimeError('WORKSPACE_ONLY_READER_REQUIRED')
    for app in ['e6893ab6-fb6a-4a1c-8390-df1698dae05e', '3f8bd8d2-4a43-4ec4-849b-788c5f49ba74']:
        sp = graph("servicePrincipals?$filter=appId eq '" + app + "'&$select=id,appRoleAssignmentRequired")['value']
        if len(sp) != 1 or not sp[0]['appRoleAssignmentRequired']:
            raise RuntimeError('ASSIGNMENT_REQUIRED_APPLICATION_EXPECTED')
        assigned = graph('servicePrincipals/' + sp[0]['id'] + '/appRoleAssignedTo?$select=principalId')['value']
        if not any(x['principalId'].lower() == security_id.lower() for x in assigned):
            raise RuntimeError('SECURITY_APPLICATION_ASSIGNMENT_REQUIRED')
    client = runtime.connect('CLOUD', None)
    try:
        baseline = runtime.remote(client, 'CLOUD', None, '''import json,subprocess,pathlib,base64
names=['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15))
assert all(i['State']['Running'] for i in items)
out=[{'name':i['Name'].lstrip('/'),'id':i['Id'],'image':i['Image'],'health':i['State'].get('Health',{}).get('Status')} for i in items]
env=dict(x.split('=',1) for x in items[0]['Config']['Env'])
assert env['AUTH_MODE']=='ENTRA_OIDC'
code="const fs=require('fs');console.log(JSON.stringify({map:JSON.parse(fs.readFileSync(process.env.HIPASS_ENTRA_ACTOR_MAP_FILE,'utf8')),path:process.env.HIPASS_ENTRA_ACTOR_MAP_FILE}))"
mapping=json.loads(subprocess.check_output(['docker','exec',items[0]['Id'],'/nodejs/bin/node','-e',code],timeout=10))
mounts=[m for m in items[1]['Mounts'] if m['Destination']=='/app/scripts/start-public-web.js']
assert len(mounts)==1
startup=pathlib.Path(mounts[0]['Source']).read_bytes()
print(json.dumps({'containers':out,'mapping':mapping,'startupPath':mounts[0]['Source'],'startup':base64.b64encode(startup).decode(),'securityRuntimeConfigured':env.get('HIPASS_AZURE_AUDIT_MI_ENABLED')=='1' and env.get('HIPASS_AUDIT_WORKSPACE_ID') is not None}))''', 30)
        paths = {
            'control': ['src/server.js', 'src/auth.js'],
            'web': ['public/app.js', 'public/index.html', 'public/capstone-auth.js', 'public/entra-auth.js',
                    'public/login-navigation.js', 'public/ui/demo-entry.js', 'public/ui/demo-entry.css',
                    'public/ui/capstone-login.css', 'public/mobile/sw.js'],
        }
        capture_dir = '/opt/highpass/security-capture-' + uuid.uuid4().hex
        for role, files in paths.items():
            name = baseline['containers'][0 if role == 'control' else 1]['name']
            data = runtime.remote(client, 'CLOUD', None,
                'NAME=' + repr(name) + '\nPATHS=' + repr(files) + '\nFOLDER=' + repr(capture_dir + '/' + role) + '\n'
                + '''import subprocess,json,pathlib,hashlib
folder=pathlib.Path(FOLDER);folder.mkdir(parents=True,mode=0o700)
out={}
for path in PATHS:
 p=subprocess.run(['docker','exec',NAME,'/nodejs/bin/node','-e',"process.stdout.write(require('fs').readFileSync(process.argv[1]))",'/app/'+path],capture_output=True,timeout=10)
 assert p.returncode==0
 target=folder/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.stdout);target.chmod(0o600)
 out[path]={'remotePath':str(target),'sha256':hashlib.sha256(p.stdout).hexdigest()}
print(json.dumps(out))''', 60)
            with gateway.root_sftp(client, None) as sftp:
                for path, metadata in data.items():
                    target = folder / 'capture' / role / path
                    target.parent.mkdir(parents=True, exist_ok=True)
                    sftp.get(metadata['remotePath'], str(target))
                    if digest(target.read_bytes()) != metadata['sha256']:
                        raise RuntimeError('SOURCE_CAPTURE_HASH_MISMATCH')
        (folder / 'baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf8')
        (folder / 'identity.json').write_text(json.dumps({'securityObjectId': security_id, 'workspaceId': workspace['customerId'],
                                                       'tenantId': config.TENANT}, indent=2), encoding='utf8')
        (folder / 'start-public-web.before.js').write_bytes(base64.b64decode(baseline['startup']))
        receipt = {'observedAt': datetime.now(timezone.utc).isoformat(), 'scope': 'SECURITY_OBSERVATORY_ONLY',
                   'phase': 'stage', 'status': 'PASS', 'guestAccepted': True, 'applicationAssignments': True,
                   'workspaceReaderVerified': True, 'securityMapActive': any(x['role'] == 'SECURITY_ADMIN' for x in baseline['mapping']['map']['actors']),
                   'folder': str(folder), 'containers': [{k: x[k] for k in ['name', 'image', 'health']} for x in baseline['containers']]}
        (folder / 'stage.json').write_text(json.dumps(receipt, indent=2), encoding='utf8')
        return receipt
    finally:
        client.close()


def operation(folder, phase):
    manifest_path = folder / 'final-manifest.json' if phase == 'verify' and (folder / 'final-manifest.json').exists() else folder / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    manifest['actorMapHash'] = digest((folder / 'candidate/actors.json').read_bytes())
    program = 'MANIFEST=' + repr(manifest) + '\nPHASE=' + repr(phase) + '\n' + (ROOT / 'scripts/security-observatory-remote.py').read_text(encoding='utf8')
    client = runtime.connect('CLOUD', None)
    try:
        if phase == 'build':
            helper = (ROOT / 'scripts/test-support/isolated-server.js').read_text(encoding='utf8')
            helper = once(helper, '  child.stderr.resume();', "  let childDiagnostic = '';\n  child.stderr.on('data', data => { childDiagnostic = (childDiagnostic + data.toString()).slice(-2000); });")
            helper = once(helper, 'throw new Error("Isolated HTTP test server exited before readiness")',
                          'throw new Error("Isolated HTTP test server exited before readiness: " + childDiagnostic)')
            destination = folder / 'candidate/checks/scripts/test-support/isolated-server.js'
            destination.write_text(helper, encoding='utf8')
            with gateway.root_sftp(client, None) as sftp:
                target = manifest['stage'] + '/checks/scripts/test-support/isolated-server.js'
                sftp.chmod(target, 0o644)
                sftp.put(str(destination), target)
        result = runtime.remote(client, 'CLOUD', None, program, 600 if phase == 'build' else 300)
        if phase == 'build':
            manifest['candidates'] = result['images']
            (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
        if phase == 'verify':
            result['publicWeb'] = verify_public(folder, manifest)
        (folder / (phase + '.json')).write_text(json.dumps(result, indent=2), encoding='utf8')
        return result
    finally:
        client.close()


def verify_public(folder, manifest):
    checks = []
    for path in manifest['roles']['web']['hashes']:
        expected = (folder / 'candidate/web' / path).read_bytes()
        if path == 'public/index.html':
            expected = expected.replace(b'<html lang="ko">', b'<html lang="ko" data-capstone="1">')
        request = urllib.request.Request(ORIGIN + '/' + path.removeprefix('public/'), headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=20) as response:
            actual = response.read(2097153)
            if response.status != 200 or digest(actual) != digest(expected):
                raise RuntimeError('AZURE_PUBLIC_SOURCE_MISMATCH')
        checks.append({'test': path, 'status': 'PASS'})
    for name, path, token, method in [
        ('OVERVIEW_UNAUTHENTICATED', '/api/security/overview', None, 'GET'),
        ('OVERVIEW_INVALID_TOKEN', '/api/security/overview', 'invalid.token.signature', 'GET'),
        ('REVIEWS_UNAUTHENTICATED', '/api/security/reviews', None, 'POST'),
    ]:
        headers = {'Origin': ORIGIN, 'Content-Type': 'application/json', 'x-hipass-role': 'SECURITY_ADMIN'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        request = urllib.request.Request(ORIGIN + path, headers=headers, method=method, data=b'{}' if method == 'POST' else None)
        try:
            response = urllib.request.urlopen(request, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = json.loads(response.read(32768))
            if response.status != 401 or body.get('error') == 'PUBLIC_ROUTE_NOT_ENABLED':
                raise RuntimeError('PUBLIC_SECURITY_AUTHENTICATION_BOUNDARY_FAILED')
            checks.append({'test': name, 'status': 'PASS', 'httpStatus': response.status})
    with urllib.request.urlopen(ORIGIN + '/api/capstone-demo/auth-config', timeout=15) as response:
        body = json.loads(response.read(32768))
        if body.get('provider') != 'ENTRA_OIDC' or body.get('redirectUri') != ORIGIN + '/entra-redirect.html':
            raise RuntimeError('PUBLIC_ENTRA_CONFIGURATION_CHANGED')
    for path in ['/hipass/', '/mobile/']:
        with urllib.request.urlopen(ORIGIN + path, timeout=15) as response:
            if response.status != 200:
                raise RuntimeError('EXISTING_WEB_SHELL_UNAVAILABLE')
        checks.append({'test': path, 'status': 'PASS'})
    return {'status': 'PASS', 'checks': checks, 'url': ORIGIN + '/hipass/?loginIntent=security'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['stage', 'prepare', 'build', 'deploy', 'verify', 'rollback'])
    parser.add_argument('--folder')
    args = parser.parse_args()
    if args.phase == 'stage':
        result = stage()
    elif args.phase == 'prepare':
        result = prepare(checked_folder(args.folder))
    else:
        result = operation(checked_folder(args.folder), args.phase)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
