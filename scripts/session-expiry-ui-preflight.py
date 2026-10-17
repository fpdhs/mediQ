"""Read-only B-only prerequisites for the exact session-expiry static candidate.

Reuse existing strict VM trust, concealed credentials, bounded commands and
config/environment/mount comparison. Do not modify historical operator pins.
"""
import importlib.util
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('session_expiry_prior_preflight', ROOT/'scripts/faq-expiry-deployment-preflight.py')
prior = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prior)
BASE = 'sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1'
CANDIDATE = 'sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e'


def context(role, labels, ingress=False):
    # This candidate affects only B. Cloud's eight-file context is not a target.
    project = 'hp-capstone-b-portal'
    stage = labels.get('com.docker.compose.project.working_dir', '')
    names = ['portal.yml', 'encryption.yml', 'patient.yml', 'faq-expiry-reviewed-20261010.yml']
    files = labels.get('com.docker.compose.project.config_files', '').split(',')
    if role != 'B' or ingress or labels.get('com.docker.compose.project') != project or not re.fullmatch(
            r'/home/server/\.highpass-app-[0-9T.+-]{20,60}', stage):
        raise ValueError('EXACT_B_SESSION_EXPIRY_CONTEXT_REQUIRED')
    if files != [stage+'/'+name for name in names]:
        raise ValueError('EXACT_FOUR_ACTIVE_B_FILES_REQUIRED')
    return project, stage, files


# Changes are isolated to this imported module instance, not the historical file.
prior.UI_BASE = BASE
prior.UI = CANDIDATE
prior.context = context


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise SystemExit('READ_ONLY_B_PREFLIGHT_TAKES_NO_OPTIONS')
    sys.argv += ['--role', 'B']
    raise SystemExit(prior.main())
