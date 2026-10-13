"""Read-only B diagnostics; no credentials or container environment in output."""
import getpass
import importlib.util
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('helper_check', root/'scripts/health-helper-runtime-check.py')
check = importlib.util.module_from_spec(spec); spec.loader.exec_module(check)
password = getpass.getpass('VM credential (concealed): ')
client = check.connect('B', password)
try:
    result = check.remote(client, 'B', password, '''import subprocess,json,time,pathlib
start=time.monotonic()
i=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1'],timeout=20))[0]
print(json.dumps({'image':i['Image'],'state':i['State']['Status'],'health':i['State'].get('Health',{}).get('Status'),
 'inspectSeconds':round(time.monotonic()-start,2),'composeFiles':i['Config']['Labels']['com.docker.compose.project.config_files'],
 'healthChecks':[{'exitCode':r['ExitCode'],'start':r['Start'],'end':r['End']} for r in i['State'].get('Health',{}).get('Log',[])],
 'uptime':pathlib.Path('/proc/uptime').read_text().split()[0],
 'memoryAvailableKB':next(s for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:'))}))
''', 30)
    print(json.dumps(result))
finally:
    client.close()
