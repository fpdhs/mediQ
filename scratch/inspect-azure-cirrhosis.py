import importlib.util, json, pathlib

ROOT = pathlib.Path('.').resolve()
spec = importlib.util.spec_from_file_location('health_helper_runtime', ROOT/'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

client = runtime.connect('CLOUD', None)

NODE_SCRIPT = r'''
import { loadUploadedCorpus } from '/app/src/medlineplus-upload-corpus.js';

const base = await loadUploadedCorpus(new URL('file:///app/data/medlineplus-upload-ko-20261012-v3/'), { includeQaHolds: true });
const cirrhosisChunks = base.chunks.filter(c => 
  c.title_ko?.includes('간경변') || c.title_ko?.includes('간경화') ||
  (c.aliases && c.aliases.some(a => a.includes('간경화') || a.includes('간경변')))
);

console.log('Cirrhosis chunks in Azure container:', cirrhosisChunks.length);
if (cirrhosisChunks.length) {
  console.log('Aliases of chunk 0:', JSON.stringify(cirrhosisChunks[0].aliases));
}

import { retrieveUploadedEvidence } from '/app/src/medlineplus-upload-corpus.js';
const q = '간경화에 대해서 알려달라';
const res = retrieveUploadedEvidence(q, base);
console.log('retrieveUploadedEvidence for "간경화에 대해서 알려달라":', JSON.stringify({ status: res.status, evidenceCount: res.evidence?.length }));
'''

import base64
b64_script = base64.b64encode(NODE_SCRIPT.encode('utf-8')).decode('ascii')
cmd = f"sudo -n docker exec hp-capstone-control-control-1 /nodejs/bin/node --input-type=module -e \"$(echo {b64_script} | base64 -d)\""

try:
    code, output = runtime.ops.run(
        client,
        cmd,
        credential=None,
        seconds=30
    )
    print("=== AZURE CHUNKS INSPECTION ===")
    print(output)
finally:
    client.close()
