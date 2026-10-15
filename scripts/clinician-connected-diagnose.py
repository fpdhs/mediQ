"""Read-only pinned Cloud source inventory. No credentials/records in output."""
import importlib.util,pathlib,json,base64
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('runtime',ROOT/'scripts/health-helper-runtime-check.py');runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
FILES={'control':['src/server.js','src/services.js','src/postgres-store.js','src/shared-health-records.js','src/synthetic-health-records.js','src/domain.js'],'web':['public/app.js']}
client=runtime.connect('CLOUD',None)
try:
 source=(ROOT/'scripts/patient-viewer-rollout-remote.py').read_text()
 result=runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD","capture",'+repr(FILES)+')))',55)
 folder=ROOT/'artifacts/azure/clinician-connected-diagnosis-20261014';folder.mkdir(parents=True,exist_ok=True)
 for part,info in result.items():
  for name,value in info['files'].items():
   if value:
    target=folder/part/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(base64.b64decode(value))
 print(json.dumps({k:{f:bool(v) for f,v in info['files'].items()} for k,info in result.items()}))
finally:client.close()
