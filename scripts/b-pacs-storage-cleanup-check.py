"""Read-only independent confirmation of the two exact temporary assignments.

Preserves the original failed cleanup receipt. Does not delete any assignment.
"""
import hashlib
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('storage_identity_check',ROOT/'scripts/capstone-key-identities.py')
identity=importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)
receipt=ROOT/'artifacts/workstation/b-storage-provision-20261013T013045Z/result.json'
source=json.loads(receipt.read_text())
ids=[c['assignmentId'] for c in source['checks'] if c['test']=='TEMPORARY_OPERATOR_ASSIGNMENT_REMOVED']
assert len(ids)==2
current=identity.azure('role','assignment','list','--all')
remaining=[i for i in ids if any(row['id'].lower()==i.lower() for row in current)]
key_scope=identity.VAULT+'/keys/highpass-b-storage-kek-20261013'
assert all(i.startswith(identity.VAULT+'/providers/Microsoft.Authorization/roleAssignments/') or i.startswith(key_scope+'/providers/Microsoft.Authorization/roleAssignments/') for i in ids)
result=dict(observedAt=datetime.now(timezone.utc).isoformat(),review='DRAFT / UNASSIGNED',readOnly=True,
    sourceReceiptSha256=hashlib.sha256(receipt.read_bytes()).hexdigest(),checkedAssignmentIds=ids,
    remainingAssignmentIds=remaining,status='PASS' if not remaining else 'FAIL',
    actualCleanup='PASS' if not remaining else 'FAIL',originalReceipt='PRESERVED_INITIAL_VERIFICATION_FAILURE')
target=receipt.parent/'cleanup-recheck.json'
with target.open('x',encoding='utf8') as stream:json.dump(result,stream,indent=2)
print(json.dumps(result))
raise SystemExit(0 if not remaining else 1)
