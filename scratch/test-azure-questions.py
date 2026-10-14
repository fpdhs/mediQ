import importlib.util, json, pathlib

ROOT = pathlib.Path('.').resolve()
spec = importlib.util.spec_from_file_location('health_helper_runtime', ROOT/'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

client = runtime.connect('CLOUD', None)

NODE_SCRIPT = r'''
import { createPatientTranslationRag } from '/app/src/health-helper-patient-translation.js';
import { HealthHelperRag } from '/app/src/health-helper-rag.js';

const rag = await createPatientTranslationRag({ env: { ...process.env, HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo' } });
const helper = new HealthHelperRag({
  translationRag: rag,
  timeoutMs: 40000,
  audit: async () => {}
});

const principal = { role: 'PATIENT', subject: 'sub-test', patientId: 'patient-test' };
const questions = [
  '간경화에 대해서 알려달라',
  '간경화에 대해 알려주세요',
  '간경화란 무엇인가요?',
  '간경변증에 대해 알려주세요',
  '간경화는 어떤 질환인가요?'
];

for (const q of questions) {
  try {
    const res = await helper.ask(principal, { question: q });
    console.log(JSON.stringify({ question: q, status: res.status, generationUsed: res.generationUsed, answer: res.answer, sourcesCount: res.sources?.length }));
  } catch (e) {
    console.log(JSON.stringify({ question: q, error: e.code || e.message }));
  }
}
'''

import base64, shlex
b64_script = base64.b64encode(NODE_SCRIPT.encode('utf-8')).decode('ascii')
cmd = f"sudo -n docker exec hp-capstone-control-control-1 /nodejs/bin/node --input-type=module -e \"$(echo {b64_script} | base64 -d)\""

try:
    code, output = runtime.ops.run(
        client,
        cmd,
        credential=None,
        seconds=90
    )
    print("=== AZURE LIVE TEST RESULT ===")
    print(output)
finally:
    client.close()
