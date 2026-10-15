"""Exact existing cloud context and narrow source-proof delta; no deployment."""
import copy
import re

CONTROL_BASE = 'sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b'
INGRESS_BASE = 'sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb'
SECRET_SOURCE = '/opt/highpass/capstone-control-secrets/hcc-source-secret'
SECRET_TARGET = '/run/secrets/hcc-source-secret'
NAMES = ['control.yml', 'ingress.yml', 'mock.yml', 'key-release.yml', 'phantom-catalog.yml',
         'patient.yml', 'patient-ingress-reviewed-20261010.yml', 'faq-expiry-reviewed-20261010.yml']
A_BASE = 'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
A_SECRET = '/opt/highpass/capstone-a-gateway-secrets/hcc-source-secret'
A_MANIFEST = '/opt/highpass/capstone-hcc-source/manifest.json'
A_SOURCE_BASE = 'sha256:2bc261db0b0e2d03aed101bc9635cbdf8061c8b60b546ce7f54acf5022315d17'
CONTROL_SOURCE_BASE = 'sha256:e435f9c631819c3ba03cebd9ffb2af0a55ca17c18e6aa6ce468d9f736c440ef2'
SOURCE_INGRESS = 'sha256:ac29dc9d739bb1fd6fa6caebd2ee001dbbbf551a51d982b8d69b7df6dda10eb5'
SOURCE_OVERLAY = 'hcc-source-reviewed-20261010.yml'


def a_context(labels, source_enabled=False):
    stage = labels.get('com.docker.compose.project.working_dir', '')
    if labels.get('com.docker.compose.project') != 'hp-capstone-a-gateway' or not re.fullmatch(
            r'/home/server/\.highpass-app-[0-9T.+-]{20,60}', stage):
        raise ValueError('EXACT_A_GATEWAY_CONTEXT_REQUIRED')
    files = labels.get('com.docker.compose.project.config_files', '').split(',')
    names = ['gateway.yml','encryption.yml','patient.yml'] + ([SOURCE_OVERLAY] if source_enabled else [])
    if files != [stage + '/' + name for name in names]:
        raise ValueError('EXACT_THREE_A_GATEWAY_FILES_REQUIRED')
    return stage, files


def a_source_only_config(baseline, candidate, image):
    normalized = copy.deepcopy(candidate)
    old = baseline['services']['gateway']; new = normalized['services']['gateway']
    if old['image'] != A_BASE or new['image'] != image or not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('EXACT_A_SOURCE_IMAGE_REQUIRED')
    new['image'] = A_BASE
    for key, value in [('HCC_SOURCE_SERVICE_TOKEN_FILE','/run/secrets/hcc-source-secret'),
                       ('HCC_SOURCE_MANIFEST_FILE','/run/hcc-source/manifest.json')]:
        if key in old['environment'] or new['environment'].pop(key, None) != value:
            raise ValueError('EXACT_NEW_A_SOURCE_ENV_REQUIRED')
    expected = [{'type':'bind','source':A_SECRET,'target':'/run/secrets/hcc-source-secret','read_only':True,
                 'bind':{'create_host_path':False}},
                {'type':'bind','source':A_MANIFEST,'target':'/run/hcc-source/manifest.json','read_only':True,
                 'bind':{'create_host_path':False}}]
    additions = [v for v in new.get('volumes',[]) if v.get('target') in [x['target'] for x in expected]]
    if sorted(additions,key=lambda v:v['target']) != sorted(expected,key=lambda v:v['target']):
        raise ValueError('EXACT_TWO_A_SOURCE_READ_ONLY_BINDS_REQUIRED')
    for volume in additions:new['volumes'].remove(volume)
    if normalized != baseline:raise ValueError('UNAPPROVED_A_NON_SOURCE_CHANGE')


def context(labels, ingress=False, source_enabled=False):
    stage = labels.get('com.docker.compose.project.working_dir', '')
    if labels.get('com.docker.compose.project') != 'hp-capstone-control' or not re.fullmatch(
            r'/home/highpassadmin/\.highpass-app-[0-9T.+-]{20,60}', stage):
        raise ValueError('EXACT_EXISTING_CLOUD_CONTEXT_REQUIRED')
    files = labels.get('com.docker.compose.project.config_files', '').split(',')
    names = NAMES + [SOURCE_OVERLAY] if source_enabled else NAMES[:-1] if ingress else NAMES
    expected = [stage + '/' + name for name in names]
    if files != expected:
        raise ValueError('EXACT_EIGHT_CONTROL_SEVEN_INGRESS_FILES_REQUIRED')
    return stage, files


def source_image_upgrade_config(baseline, candidate, role, image):
    """Preserve all active source settings; permit one exact role image change."""
    if role not in {'gateway', 'control'} or not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise ValueError('EXACT_SOURCE_UPGRADE_ROLE_IMAGE_REQUIRED')
    previous = A_SOURCE_BASE if role == 'gateway' else CONTROL_SOURCE_BASE
    old = baseline['services'][role]
    if old['image'] != previous or image == previous:
        raise ValueError('EXACT_ACTIVE_SOURCE_BASELINE_REQUIRED')
    required_env = ({'HCC_SOURCE_SERVICE_TOKEN_FILE': SECRET_TARGET,
                     'HCC_SOURCE_MANIFEST_FILE': '/run/hcc-source/manifest.json'} if role == 'gateway' else
                    {'HIPASS_CAPSTONE_HCC_CATALOG': '1', 'HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE': SECRET_TARGET,
                     'HIPASS_CAPSTONE_SINGLE_WRITER': '1', 'HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID': 'HOSP-A'})
    if any(old.get('environment', {}).get(k) != v for k, v in required_env.items()):
        raise ValueError('ACTIVE_SOURCE_SETTINGS_REQUIRED')
    if role == 'control':
        if baseline['services']['ingress']['image'] != SOURCE_INGRESS:
            raise ValueError('EXACT_ACTIVE_SOURCE_INGRESS_REQUIRED')
        if old['environment'].get('HIPASS_CAPSTONE_MAIN_SCENARIO'):
            raise ValueError('MAIN_PROFILE_ACTIVATION_OUT_OF_SCOPE')
    binds = [(A_SECRET, SECRET_TARGET), (A_MANIFEST, '/run/hcc-source/manifest.json')] if role == 'gateway' else [(SECRET_SOURCE, SECRET_TARGET)]
    for source, target in binds:
        expected = {'type': 'bind', 'source': source, 'target': target, 'read_only': True,
                    'bind': {'create_host_path': False}}
        if [v for v in old.get('volumes', []) if v.get('target') == target] != [expected]:
            raise ValueError('ACTIVE_SOURCE_READ_ONLY_BIND_REQUIRED')
    normalized = copy.deepcopy(candidate)
    if normalized['services'][role]['image'] != image:
        raise ValueError('EXACT_SOURCE_UPGRADE_CANDIDATE_REQUIRED')
    normalized['services'][role]['image'] = previous
    if normalized != baseline:
        raise ValueError('NON_IMAGE_SOURCE_UPGRADE_CHANGE')


def source_only_config(baseline, candidate, control_image, ingress_image):
    """Permit two reviewed images + one source credential mount/opt-in only."""
    if any(not re.fullmatch(r'sha256:[a-f0-9]{64}', value) for value in [control_image, ingress_image]):
        raise ValueError('EXACT_CANDIDATE_IMAGE_IDS_REQUIRED')
    normalized = copy.deepcopy(candidate)
    for name, old, new in [('control', CONTROL_BASE, control_image), ('ingress', INGRESS_BASE, ingress_image)]:
        if baseline['services'][name]['image'] != old or normalized['services'][name]['image'] != new:
            raise ValueError('EXACT_ROLE_IMAGE_PAIR_REQUIRED')
        normalized['services'][name]['image'] = old
    prior = baseline['services']['control']
    env = normalized['services']['control']['environment']
    if prior['environment'].get('HIPASS_CAPSTONE_SINGLE_WRITER') != '1' or prior['environment'].get('HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID') != 'HOSP-A':
        raise ValueError('SINGLE_WRITER_HOSPITAL_A_BASELINE_REQUIRED')
    if prior['environment'].get('HIPASS_CAPSTONE_MAIN_SCENARIO') or env.get('HIPASS_CAPSTONE_MAIN_SCENARIO'):
        raise ValueError('MAIN_PROFILE_ACTIVATION_OUT_OF_SCOPE')
    for key, value in [('HIPASS_CAPSTONE_HCC_CATALOG', '1'), ('HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE', SECRET_TARGET)]:
        if env.get(key) != value:
            raise ValueError('EXACT_SOURCE_VERIFICATION_OPT_IN_REQUIRED')
        if key in prior['environment']:
            env[key] = prior['environment'][key]
        else:
            del env[key]
    volumes = normalized['services']['control'].get('volumes', [])
    additions = [row for row in volumes if row.get('target') == SECRET_TARGET]
    expected = {'type': 'bind', 'source': SECRET_SOURCE, 'target': SECRET_TARGET,
                'read_only': True, 'bind': {'create_host_path': False}}
    if additions != [expected] or any(row.get('target') == SECRET_TARGET for row in prior.get('volumes', [])):
        raise ValueError('EXACT_NEW_READ_ONLY_FILE_BIND_REQUIRED')
    volumes.remove(additions[0])
    if normalized != baseline:
        raise ValueError('UNAPPROVED_NON_SOURCE_CONFIG_CHANGE')
