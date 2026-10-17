"""Bounded source-only promotion journal, mandatory rollback rehearsal, exact review."""
import hashlib
import pathlib
import re
from datetime import datetime, timezone


def validate_review(root, review, candidates, required_files):
    if (review.get('review') != 'PASS' or not review.get('reviewer')
            or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', review.get('reviewDate', ''))
            or review.get('exceptions') != [] or review.get('candidates') != candidates):
        raise ValueError('EXACT_SOURCE_CANDIDATE_REVIEW_REQUIRED')
    entries = review.get('files', [])
    if len(entries) != len(required_files) or {row['path'] for row in entries} != set(required_files):
        raise ValueError('EXACT_SOURCE_REVIEW_FILE_SET_REQUIRED')
    for row in entries:
        source = root / row['path']
        path = source.resolve()
        if not path.is_relative_to(root.resolve()) or source.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('SOURCE_REVIEW_EVIDENCE_CHANGED')


def validate_preflight(receipt, candidates, now=None):
    age = ((now or datetime.now(timezone.utc)) - datetime.fromisoformat(receipt['observedAt'])).total_seconds()
    if (receipt.get('status') != 'PASS' or not 0 <= age < 3600
            or receipt.get('candidateControl') != candidates['control']
            or receipt.get('candidateIngress') != candidates['ingress']
            or any(receipt.get(k) is not True for k in ['runtimeEnvironmentAndBindMountsMatch',
                                                       'sourceOnlyConfigDelta','rollbackImagesAvailable','containersUnchanged'])):
        raise ValueError('FRESH_EXACT_SOURCE_PREFLIGHT_REQUIRED')


def candidate_scan_path(role, image):
    if role not in {'control', 'a', 'ingress'} or not isinstance(image, str):
        raise ValueError('EXACT_SOURCE_IMAGE_REQUIRED')
    tag = image.rsplit(':', 1)[-1]
    prefix = f'capstone-hcc-source-{role}-'
    revision = tag.removeprefix(prefix)
    if tag == revision or not re.fullmatch(r'\d{8}-\d{2}', revision):
        raise ValueError('EXACT_SOURCE_IMAGE_REVISION_REQUIRED')
    return f'artifacts/security/container-scan/hcc-source-{role}-{revision}.json'


def promotion_sequence(adapter, roles=('control', 'ingress')):
    """Adapter owns strict readiness/runtime checks; mutation flag precedes first call."""
    checks, attempted, rollback = [], False, 'NOT REQUIRED'
    phase = 'PREREQUISITES'
    try:
        adapter.preflight()
        phase = 'ACTIVATION'
        attempted = True
        for role in roles:adapter.activate(role, 'candidate')
        adapter.verify('candidate')
        checks.append('CANDIDATE_STRICT_TLS_AND_PROTECTED_RUNTIME')
        phase = 'ROLLBACK_REHEARSAL'
        for role in reversed(roles):adapter.activate(role, 'baseline')
        adapter.verify('baseline')
        rollback = 'PASS'
        checks.append('BASELINE_STRICT_TLS_ROLLBACK')
        phase = 'REACTIVATION'
        for role in roles:adapter.activate(role, 'candidate')
        adapter.verify('candidate')
        checks.append('CANDIDATE_REACTIVATION')
        return {'status':'PASS','checks':checks,'rollback':rollback}
    except Exception:
        if attempted:
            # Independent attempts: one failed restoration must not skip the other.
            failures = []
            for role in reversed(roles):
                try:adapter.activate(role, 'baseline')
                except Exception:failures.append(role)
            try:adapter.verify('baseline')
            except Exception:failures.append('readiness')
            rollback = 'FAIL' if failures else 'PASS'
        return {'status':'FAIL' if attempted else 'NOT VERIFIED','phase':phase,
                'reason':'SOURCE_ROLLOUT_NOT_COMPLETED','checks':checks,'rollback':rollback}
