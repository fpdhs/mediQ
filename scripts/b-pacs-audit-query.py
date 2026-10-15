"""Bounded authenticated Azure audit query. No token/key/certificate output."""
import argparse
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit_query_identity',ROOT/'scripts/capstone-key-identities.py')
identity=importlib.util.module_from_spec(spec);spec.loader.exec_module(identity)
WORKSPACE='21d34104-2703-491f-a2c1-b74f6ac6bf07'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--since',required=True);args=parser.parse_args()
    since=datetime.fromisoformat(args.since.replace('Z','+00:00'))
    if since.tzinfo is None:raise RuntimeError('TIMEZONE_REQUIRED')
    result=dict(review='DRAFT / UNASSIGNED',observedAt=datetime.now(timezone.utc).isoformat(),workspace=WORKSPACE)
    folder=ROOT/'artifacts/azure'/('b-key-audit-query-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
    query="""AzureDiagnostics
| where TimeGenerated >= datetime(SINCE)
| where ResourceProvider == 'MICROSOFT.KEYVAULT' and Category == 'AuditEvent'
| where Resource in~ ('KV-HP-DEMO-4869EDD9','KV-HP-RECOVER-4869EDD9')
| project TimeGenerated, Resource, OperationName, ResultType, ResultSignature,
 CorrelationId, RequestUri=tostring(column_ifexists('requestUri_s','')),
 OperatorId=tostring(column_ifexists('identity_claim_oid_g',''))
| order by TimeGenerated desc
| take 100""".replace('SINCE',since.isoformat())
    result['query']=query
    try:
        value=identity.azure('rest','--method','post','--url','https://api.loganalytics.azure.com/v1/workspaces/'+WORKSPACE+'/query',
            '--resource','https://api.loganalytics.io','--body',json.dumps({'query':query,'timespan':'PT2H'}))
        rows=[]
        for table in value.get('tables',[]):
            names=[c['name'] for c in table['columns']]
            rows.extend(dict(zip(names,row)) for row in table.get('rows',[]))
        result['events']=rows
        result['status']='PASS' if rows else 'NOT VERIFIED'
        result['reason']=None if rows else 'NO_MATCHING_AUDIT_EVENT_YET'
    except Exception as error:result.update(status='NOT VERIFIED',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)),flush=True)
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
