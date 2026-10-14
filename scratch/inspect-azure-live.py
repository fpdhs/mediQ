import importlib.util, json, pathlib

ROOT = pathlib.Path('.').resolve()
spec = importlib.util.spec_from_file_location('health_helper_runtime', ROOT/'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

client = runtime.connect('CLOUD', None)
try:
    code, output = runtime.ops.run(client, "sudo -n docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'", credential=None, seconds=15)
    print("=== DOCKER PS ===")
    print(output)
    
    code, output = runtime.ops.run(client, "sudo -n docker inspect hp-capstone-control-control-1 --format '{{.Image}}'", credential=None, seconds=15)
    print("=== CONTROL IMAGE ===")
    print(output.strip())
    
    code, output = runtime.ops.run(client, "sudo -n docker inspect hp-public-web-web-1 --format '{{.Image}}'", credential=None, seconds=15)
    print("=== WEB IMAGE ===")
    print(output.strip())
finally:
    client.close()
