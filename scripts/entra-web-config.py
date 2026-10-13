"""Prepare two-account Entra web configuration. No deployment or public ingress.

Default is read-only. --apply creates dedicated single-tenant SPA/API registrations
and assigns only the two accepted guests. No Graph permissions or Azure RBAC grants.
Private identity configuration and receipts stay in ACL-protected ignored artifacts.
"""
import argparse
import importlib.util
import json
import os
import pathlib
import subprocess
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

ROOT = pathlib.Path(__file__).resolve().parents[1]
TENANT = 'ad21525c-fc0f-4dbc-a403-67ce00add0e4'
SUB = 'a3c0e7d4-ce09-4991-946b-88574869edd9'
REDIRECT = 'https://192.168.111.149:9443/entra-redirect.html'
NAMES = {'API': 'highpass-synthetic-web-api-20261013', 'SPA': 'highpass-synthetic-web-spa-20261013'}


def protected_folder():
    folder = ROOT / 'artifacts/azure' / ('entra-web-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6])
    if subprocess.run(['git', 'check-ignore', str(folder / 'result.json')], cwd=ROOT, capture_output=True, timeout=5).returncode:
        raise RuntimeError('IGNORED_ARTIFACT_REQUIRED')
    folder.mkdir(parents=True, exist_ok=False)
    if os.name == 'nt':
        owner = subprocess.check_output(['whoami.exe'], timeout=5).decode().strip()
        acl = subprocess.run(['icacls.exe', str(folder), '/inheritance:r', '/grant:r', owner + ':(OI)(CI)F',
                              '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], capture_output=True, timeout=10)
        if acl.returncode:
            raise RuntimeError('PROTECTED_ACL_REQUIRED')
    return folder


def actor_map(users):
    if len(users) != 2 or {u['role'] for u in users} != {'PATIENT', 'DOCTOR'}:
        raise ValueError('TWO_ROLES_REQUIRED')
    actors = []
    for user in users:
        uuid.UUID(user['objectId'])
        if user.get('userType') != 'Guest' or user.get('externalUserState') != 'Accepted':
            raise ValueError('ACCEPTED_GUEST_REQUIRED')
        if user['role'] == 'PATIENT':
            actors.append(dict(objectId=user['objectId'], actorId='synthetic-patient-hcc', role='PATIENT', patientId='MEDIQ-SYN-HCC-001'))
        else:
            actors.append(dict(objectId=user['objectId'], actorId='synthetic-doctor-b', role='DOCTOR', doctorId='DOC-B-01', hospitalId='HOSP-B'))
    if len({a['objectId'] for a in actors}) != 2:
        raise ValueError('DISTINCT_USERS_REQUIRED')
    return dict(schemaVersion=1, tenantId=TENANT, actors=actors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--users-receipt', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    receipt = (ROOT / args.users_receipt).resolve()
    if not receipt.is_relative_to((ROOT / 'artifacts/azure').resolve()):
        raise SystemExit('PROTECTED_USER_RECEIPT_REQUIRED')
    users = json.loads(receipt.read_text(encoding='utf8'))['users']
    mapping = actor_map(users)
    spec = importlib.util.spec_from_file_location('entra_identity', ROOT / 'scripts/capstone-key-identities.py')
    identity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(identity)
    folder = protected_folder()
    result = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED',
                  apps={}, deployed=False, publicIngress=False, serverMappingApplied=False)
    phase = 'ACCOUNT'
    def graph(method, path, body=None):
        extra = ('--body', json.dumps(body)) if body is not None else ()
        return identity.azure('rest', '--method', method, '--url', 'https://graph.microsoft.com/v1.0/' + path, *extra)
    try:
        account = identity.azure('account', 'show')
        if account['id'] != SUB or account['tenantId'] != TENANT:
            raise RuntimeError('APPROVED_TENANT_REQUIRED')
        for user in users:
            live = graph('get', 'users/' + user['objectId'] + '?$select=id,userType,externalUserState')
            if live['id'] != user['objectId'] or live['userType'] != 'Guest' or live.get('externalUserState') != 'Accepted':
                raise RuntimeError('LIVE_ACCEPTED_USER_REQUIRED')
        for kind, name in NAMES.items():
            phase = kind + '_REGISTRATION'
            query = urlencode({'$filter': "displayName eq '" + name + "'"})
            found = graph('get', 'applications?' + query)['value']
            if len(found) > 1:
                raise RuntimeError('AMBIGUOUS_APP')
            if not found and args.apply:
                payload = dict(displayName=name, signInAudience='AzureADMyOrg', isFallbackPublicClient=False,
                               web=dict(implicitGrantSettings=dict(enableAccessTokenIssuance=False, enableIdTokenIssuance=False)))
                if kind == 'API':
                    payload['api'] = dict(requestedAccessTokenVersion=2, oauth2PermissionScopes=[dict(
                        id=str(uuid.uuid4()), value='access_as_user', type='Admin', isEnabled=True,
                        adminConsentDisplayName='Access Highpass synthetic demo',
                        adminConsentDescription='Access only the server-assigned synthetic patient or doctor.')])
                else:
                    payload['spa'] = dict(redirectUris=[REDIRECT])
                found = [graph('post', 'applications', payload)]
                if kind == 'API':
                    graph('patch', 'applications/' + found[0]['id'], dict(identifierUris=['api://' + found[0]['appId']]))
            if not found:
                result['apps'][kind] = dict(status='NOT REGISTERED')
                continue
            app = graph('get', 'applications/' + found[0]['id'])
            if app['signInAudience'] != 'AzureADMyOrg' or app.get('passwordCredentials') or app.get('keyCredentials'):
                raise RuntimeError('APP_CONFIGURATION_CONFLICT')
            if kind == 'API':
                scopes = app['api']['oauth2PermissionScopes']
                if len(scopes) != 1 or scopes[0]['value'] != 'access_as_user' or scopes[0]['isEnabled'] is not True or app['api']['requestedAccessTokenVersion'] != 2:
                    raise RuntimeError('API_SCOPE_CONFLICT')
            elif app['spa']['redirectUris'] != [REDIRECT]:
                raise RuntimeError('SPA_REDIRECT_CONFLICT')
            result['apps'][kind] = dict(status='REGISTERED', objectId=app['id'], appId=app['appId'], configuration=app)
        if args.apply and all(v.get('appId') for v in result['apps'].values()):
            api, spa = result['apps']['API'], result['apps']['SPA']
            scope_id = api['configuration']['api']['oauth2PermissionScopes'][0]['id']
            phase = 'CUSTOM_API_SCOPE_LINK'
            expected_resource = [dict(resourceAppId=api['appId'],resourceAccess=[dict(id=scope_id,type='Scope')])]
            expected_preauth = [dict(appId=spa['appId'],delegatedPermissionIds=[scope_id])]
            if spa['configuration'].get('requiredResourceAccess') not in ([], expected_resource):
                raise RuntimeError('EXISTING_RESOURCE_PERMISSION_CONFLICT')
            if api['configuration']['api'].get('preAuthorizedApplications') not in ([], expected_preauth):
                raise RuntimeError('EXISTING_PREAUTHORIZATION_CONFLICT')
            graph('patch', 'applications/' + spa['objectId'], dict(requiredResourceAccess=[dict(resourceAppId=api['appId'],resourceAccess=[dict(id=scope_id,type='Scope')])]))
            graph('patch', 'applications/' + api['objectId'], dict(api={**api['configuration']['api'], 'preAuthorizedApplications':[dict(appId=spa['appId'],delegatedPermissionIds=[scope_id])]}))
            for app in [api, spa]:
                phase = 'ASSIGNMENT_REQUIRED'
                found = graph('get', 'servicePrincipals?' + urlencode({'$filter': "appId eq '" + app['appId'] + "'"}))['value']
                if len(found) > 1:
                    raise RuntimeError('AMBIGUOUS_SERVICE_PRINCIPAL')
                sp = found[0] if found else graph('post', 'servicePrincipals', dict(appId=app['appId'],appRoleAssignmentRequired=True))
                graph('patch', 'servicePrincipals/' + sp['id'], dict(appRoleAssignmentRequired=True))
                assignments = graph('get', 'servicePrincipals/' + sp['id'] + '/appRoleAssignedTo')['value']
                if any(a['principalId'] not in {u['objectId'] for u in users} for a in assignments):
                    raise RuntimeError('UNEXPECTED_APP_ASSIGNMENT')
                for user in users:
                    if not any(a['principalId'] == user['objectId'] for a in assignments):
                        graph('post', 'servicePrincipals/' + sp['id'] + '/appRoleAssignedTo', dict(principalId=user['objectId'],resourceId=sp['id'],appRoleId='00000000-0000-0000-0000-000000000000'))
                readback = graph('get', 'servicePrincipals/' + sp['id'] + '/appRoleAssignedTo')['value']
                if len(readback) != 2 or {a['principalId'] for a in readback} != {u['objectId'] for u in users}:
                    raise RuntimeError('ASSIGNMENT_READBACK_FAILED')
                app['assignmentRequired'] = graph('get', 'servicePrincipals/' + sp['id'])['appRoleAssignmentRequired']
                if app['assignmentRequired'] is not True:
                    raise RuntimeError('ASSIGNMENT_REQUIRED_READBACK_FAILED')
        if len(result['apps']) == 2 and all(v.get('appId') for v in result['apps'].values()):
            phase = 'READ_ONLY_CONFIGURATION_VERIFICATION'
            api, spa = result['apps']['API'], result['apps']['SPA']
            for app in [api, spa]:
                app['configuration'] = graph('get', 'applications/' + app['objectId'])
                principals = graph('get', 'servicePrincipals?' + urlencode({'$filter': "appId eq '" + app['appId'] + "'"}))['value']
                if len(principals) != 1 or principals[0]['appRoleAssignmentRequired'] is not True:
                    raise RuntimeError('ASSIGNMENT_REQUIRED_READBACK_FAILED')
                assignments = graph('get', 'servicePrincipals/' + principals[0]['id'] + '/appRoleAssignedTo')['value']
                if len(assignments) != 2 or {a['principalId'] for a in assignments} != {u['objectId'] for u in users}:
                    raise RuntimeError('ASSIGNMENT_READBACK_FAILED')
                if any(a['appRoleId'] != '00000000-0000-0000-0000-000000000000' for a in assignments):
                    raise RuntimeError('UNEXPECTED_ROLE_ASSIGNMENT')
                app['assignmentRequired'] = True
            scope_id = api['configuration']['api']['oauth2PermissionScopes'][0]['id']
            if api['configuration']['identifierUris'] != ['api://' + api['appId']]:
                raise RuntimeError('API_IDENTIFIER_READBACK_FAILED')
            if spa['configuration']['requiredResourceAccess'] != [dict(resourceAppId=api['appId'],resourceAccess=[dict(id=scope_id,type='Scope')])]:
                raise RuntimeError('SPA_SCOPE_READBACK_FAILED')
            if api['configuration']['api']['preAuthorizedApplications'] != [dict(appId=spa['appId'],delegatedPermissionIds=[scope_id])]:
                raise RuntimeError('API_PREAUTHORIZATION_READBACK_FAILED')
            config = dict(AUTH_MODE='ENTRA_OIDC', ENTRA_TENANT_ID=TENANT, ENTRA_SPA_CLIENT_ID=spa['appId'],
                          ENTRA_API_AUDIENCE=api['appId'], ENTRA_API_SCOPE='access_as_user', ENTRA_REDIRECT_URI=REDIRECT,
                          HIPASS_ENTRA_ACTOR_MAP_FILE='/run/config/entra-actors.json', HIPASS_CAPSTONE_MOCK_IDP='0')
            (folder / 'runtime-config.json').write_text(json.dumps(config,indent=2),encoding='utf8')
            (folder / 'entra-actors.json').write_text(json.dumps(mapping,indent=2),encoding='utf8')
        result['status'] = 'PASS' if all(v.get('appId') for v in result['apps'].values()) else 'NOT VERIFIED'
    except Exception as error:
        result.update(status='FAIL',failedPhase=phase,reason=type(error).__name__)
    (folder / 'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(status=result['status'],phase=result.get('failedPhase'),
                         apps={k:v['status'] for k,v in result['apps'].items()},evidence=str(folder / 'result.json'),deployed=False)))
    return 0 if result['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
