import importlib.util, pathlib

ROOT = pathlib.Path('.')
r = importlib.util.spec_from_file_location('rt', 'scripts/health-helper-runtime-check.py')
rt = importlib.util.module_from_spec(r)
r.loader.exec_module(rt)

c = rt.connect('CLOUD', None)
code = """
import subprocess, json
s = subprocess.check_output(['docker', 'exec', 'hp-capstone-control-control-1', '/nodejs/bin/node', '-e', 'console.log(require("fs").readFileSync("/app/src/server.js", "utf8"))']).decode()
lines = [line for line in s.splitlines() if any(k in line for k in ["translationRag", "syntheticScenario", "createOllamaHelperModel"])]
print(json.dumps({
    "contains_translationRag": "translationRag" in s,
    "contains_createSyntheticHccProvenanceAnswer": "createSyntheticHccProvenanceAnswer" in s,
    "matching_lines": lines
}))
"""
res = rt.remote(c, 'CLOUD', None, code, 20)
print("REMOTE RESULT:")
print(res)
c.close()
