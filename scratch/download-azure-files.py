import importlib.util, pathlib

ROOT = pathlib.Path('.').resolve()
spec = importlib.util.spec_from_file_location('health_helper_runtime', ROOT/'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

client = runtime.connect('CLOUD', None)
try:
    read_file = lambda p: f"/nodejs/bin/node -e \"process.stdout.write(require('fs').readFileSync('{p}'))\""
    code, output = runtime.ops.run(
        client,
        f"sudo -n docker exec hp-capstone-control-control-1 {read_file('/app/src/medlineplus-upload-corpus.js')}",
        credential=None,
        seconds=20
    )
    (ROOT / 'scratch/azure-medlineplus-upload-corpus.js').write_text(output, encoding='utf-8')
    print("Saved Azure medlineplus-upload-corpus.js! Size:", len(output))

    code, output = runtime.ops.run(
        client,
        f"sudo -n docker exec hp-capstone-control-control-1 {read_file('/app/src/health-helper-patient-translation.js')}",
        credential=None,
        seconds=20
    )
    (ROOT / 'scratch/azure-health-helper-patient-translation.js').write_text(output, encoding='utf-8')
    print("Saved Azure health-helper-patient-translation.js! Size:", len(output))
finally:
    client.close()
