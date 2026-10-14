"""Read-only aggregate deployed schema check; no identities or credentials emitted."""
import importlib.util,pathlib,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('runtime',ROOT/'scripts/health-helper-runtime-check.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
client=runtime.connect('CLOUD',None)
try:
 result=runtime.remote(client,'CLOUD',None,'''import subprocess,json
sql="SELECT json_build_object('scopeColumn', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='consents' AND column_name='health_record_scope'), 'consents', (SELECT count(*) FROM consents), 'explicitHealthScopes', (SELECT count(*) FROM consents WHERE health_record_scope IS NOT NULL), 'registeredDoctors', (SELECT count(*) FROM doctors), 'domainDoctorRoles', (SELECT count(*) FROM doctors WHERE 'Doctor'=ANY(roles)))"
r=subprocess.run(['docker','exec','hp-capstone-control-postgres-1','psql','-U','hipass_bootstrap','-d','hipass','-At','-c',sql],capture_output=True,text=True,timeout=15)
assert r.returncode==0,'STORE_CHECK_FAILED'
print(json.dumps(json.loads(r.stdout)))
''',25)
 (ROOT/'artifacts/azure/clinician-connected-20261014/store-verification.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result))
finally:client.close()
