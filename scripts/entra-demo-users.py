"""Invite two explicitly selected demo identities; no app/admin/RBAC grants.

Personal emails and object IDs remain in protected ignored artifacts only.
Invitation redemption and actual app assignment are separate gates.
"""
import argparse
import importlib.util
import json
import os
import pathlib
import subprocess
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUB = 'a3c0e7d4-ce09-4991-946b-88574869edd9'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--patient-email', required=True)
    parser.add_argument('--doctor-email', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--resend', action='store_true')
    args = parser.parse_args()
    if args.resend and not args.apply:
        raise SystemExit('RESEND_REQUIRES_EXPLICIT_APPLY')
    emails = [args.patient_email.strip().lower(), args.doctor_email.strip().lower()]
    if len(set(emails)) != 2 or any("'" in x or len(x) > 254 or x.count('@') != 1 or any(c.isspace() for c in x) for x in emails):
        raise SystemExit('TWO_DISTINCT_VALID_EMAILS_REQUIRED')
    spec = importlib.util.spec_from_file_location('demo_identity', ROOT / 'scripts/capstone-key-identities.py')
    identity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(identity)
    folder = ROOT / 'artifacts/azure' / ('entra-demo-users-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6])
    ignored = subprocess.run(['git', 'check-ignore', str(folder / 'result.json')], cwd=ROOT, capture_output=True, timeout=5)
    if ignored.returncode:
        raise SystemExit('IGNORED_ARTIFACT_DIRECTORY_REQUIRED')
    folder.mkdir(parents=True, exist_ok=False)
    if os.name == 'nt':
        owner = subprocess.check_output(['whoami.exe'], timeout=5).decode().strip()
        acl = subprocess.run(['icacls.exe', str(folder), '/inheritance:r', '/grant:r', owner + ':(OI)(CI)F',
                              '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], capture_output=True, timeout=10)
        if acl.returncode:
            raise SystemExit('PROTECTED_ARTIFACT_ACL_REQUIRED')
    started = time.monotonic()
    result = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED', users=[],
                  appAssignment=False, serverMappingApplied=False, publicIngress=False)
    phase = 'ACCOUNT'
    try:
        account = identity.azure('account', 'show')
        if account['id'] != SUB or account['tenantId'] != identity.TENANT:
            raise RuntimeError('APPROVED_TENANT_REQUIRED')
        for role, email in zip(['PATIENT', 'DOCTOR'], emails):
            phase = role + '_LOOKUP'
            query = urlencode({'$filter': "mail eq '" + email + "' or otherMails/any(x:x eq '" + email + "')",
                               '$select': 'id,mail,userType,externalUserState', '$count': 'true'})
            found = identity.azure('rest', '--method', 'get', '--url', 'https://graph.microsoft.com/v1.0/users?' + query,
                                   '--headers', 'ConsistencyLevel=eventual')['value']
            if len(found) > 1:
                raise RuntimeError('AMBIGUOUS_EXISTING_IDENTITY')
            created = False
            resent = False
            if args.resend:
                if len(found) != 1 or found[0].get('userType') != 'Guest' or found[0].get('externalUserState') != 'PendingAcceptance':
                    raise RuntimeError('EXISTING_PENDING_GUEST_REQUIRED')
                phase = role + '_RESEND'
                invitation = identity.azure('rest', '--method', 'post', '--url', 'https://graph.microsoft.com/v1.0/invitations',
                    '--body', json.dumps(dict(invitedUserEmailAddress=email, invitedUserType='Guest',
                        invitedUserDisplayName='Highpass Synthetic Demo ' + role,
                        inviteRedirectUrl='https://myapps.microsoft.com/', sendInvitationMessage=True,
                        resetRedemption=False, invitedUserMessageInfo=dict(messageLanguage='ko-KR'))))
                if invitation['invitedUser']['id'] != found[0]['id']:
                    raise RuntimeError('RESEND_OBJECT_ID_MISMATCH')
                resent = True
            if not found:
                if not args.apply:
                    result['users'].append(dict(role=role, status='NOT REGISTERED'))
                    continue
                phase = role + '_INVITE'
                invitation = identity.azure('rest', '--method', 'post', '--url', 'https://graph.microsoft.com/v1.0/invitations',
                    '--body', json.dumps(dict(invitedUserEmailAddress=email, invitedUserType='Guest',
                        invitedUserDisplayName='Highpass Synthetic Demo ' + role,
                        inviteRedirectUrl='https://myapps.microsoft.com/', sendInvitationMessage=True,
                        invitedUserMessageInfo=dict(messageLanguage='ko-KR'))))
                user_id = invitation['invitedUser']['id']
                created = True
            else:
                user_id = found[0]['id']
            uuid.UUID(user_id)
            phase = role + '_READBACK'
            user = identity.azure('rest', '--method', 'get', '--url',
                'https://graph.microsoft.com/v1.0/users/' + user_id + '?$select=id,mail,userType,externalUserState')
            result['users'].append(dict(role=role, objectId=user['id'], userType=user['userType'],
                invitationCreated=created, externalUserState=user.get('externalUserState'),
                invitationResent=resent,
                status='DIRECTORY REGISTERED; APP ROLE NOT APPLIED'))
        result['status'] = 'PASS' if len(result['users']) == 2 and all('objectId' in x for x in result['users']) else 'NOT VERIFIED'
    except Exception as error:
        result['status'] = 'FAIL'
        result['failedPhase'] = phase
        result['reason'] = type(error).__name__
    result['elapsedSeconds'] = round(time.monotonic() - started, 3)
    (folder / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    # Do not print object IDs, invitation links or email addresses.
    print(json.dumps(dict(status=result['status'], users=[{k:v for k,v in x.items() if k != 'objectId'} for x in result['users']],
                          failedPhase=result.get('failedPhase'), evidence=str(folder / 'result.json'))))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
