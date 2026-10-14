import importlib.util, hashlib, pathlib

ROOT = pathlib.Path('.').resolve()
spec = importlib.util.spec_from_file_location('health_helper_runtime', ROOT/'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

local_path = ROOT / 'src/medlineplus-upload-corpus.js'
local_hash = hashlib.sha256(local_path.read_bytes()).hexdigest()
print('Local src/medlineplus-upload-corpus.js SHA256:', local_hash)

client = runtime.connect('CLOUD', None)
try:
    node_sha = lambda p: f"/nodejs/bin/node -e \"console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('{p}')).digest('hex'))\""
    code, output = runtime.ops.run(
        client,
        f"sudo -n docker exec hp-capstone-control-control-1 {node_sha('/app/src/medlineplus-upload-corpus.js')}",
        credential=None,
        seconds=15
    )
    print("Azure /app/src/medlineplus-upload-corpus.js:", output.strip())

    code, output = runtime.ops.run(
        client,
        f"sudo -n docker exec hp-capstone-control-control-1 {node_sha('/app/src/health-helper-patient-translation.js')}",
        credential=None,
        seconds=15
    )
    print("Azure /app/src/health-helper-patient-translation.js:", output.strip())

    code, output = runtime.ops.run(
        client,
        f"sudo -n docker exec hp-capstone-control-control-1 {node_sha('/app/data/medlineplus-upload-ko-20261012-v3/manifest.json')}",
        credential=None,
        seconds=15
    )
    print("Azure /app/data/manifest.json:", output.strip())
finally:
    client.close()
