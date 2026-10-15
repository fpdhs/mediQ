"""Verify installed Azure RAG and existing private model socket with synthetic service principals; not an Entra browser login."""
import argparse,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('rag_release',ROOT/'scripts/patient-rag-azure-release.py');release=importlib.util.module_from_spec(s);s.loader.exec_module(release)
JS=r'''
import assert from 'node:assert/strict';
import {createPatientTranslationRag} from '/app/src/health-helper-patient-translation.js';
import {HealthHelperRag} from '/app/src/health-helper-rag.js';
import {createSyntheticHccProvenanceAnswer} from '/app/src/health-helper-synthetic-hcc-provenance.js';
import {HCC_PATIENT_ID,HCC_PATIENT_SUBJECT,isHccCatalogCommitted} from '/app/src/capstone-hcc-catalog.js';
import {PostgresStore} from '/app/src/postgres-store.js';
import {readFileSync} from 'node:fs';
import pg from '/app/node_modules/pg/lib/index.js';
const {Client}=pg;
const logs=[],checks=[];
const dbUrl=process.env.DATABASE_URL??`postgres://${encodeURIComponent(process.env.POSTGRES_USER)}:${encodeURIComponent(readFileSync(process.env.POSTGRES_PASSWORD_FILE,'utf8').trim())}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT??5432}/${process.env.POSTGRES_DB}`;
const store=new PostgresStore(dbUrl);store.client=new Client({connectionString:dbUrl,connectionTimeoutMillis:5000});await store.client.connect();
try{
 await store.client.query("BEGIN READ ONLY; SET LOCAL statement_timeout='5s'");
 const patients=await store.readTable('patients'),studies=await store.readTable('imagingStudies'),series=await store.readTable('series');
 store.persistedData={patients,imagingStudies:studies.map(study=>({...study,series:series.filter(s=>s.studyInstanceUid===study.studyInstanceUid)}))};
 await store.client.query('ROLLBACK');
}finally{await store.client.end();}
assert.ok(isHccCatalogCommitted(store));
const rag=await createPatientTranslationRag({env:{...process.env,HIPASS_HEALTH_HELPER_TRANSLATION_RAG:'school-demo'}});
const helper=new HealthHelperRag({translationRag:rag,timeoutMs:40000,audit:async row=>logs.push(row),
 syntheticScenario:({principal,question})=>createSyntheticHccProvenanceAnswer({principal,question,enabled:true,catalogCommitted:isHccCatalogCommitted(store)})});
const principal={role:'PATIENT',subject:HCC_PATIENT_SUBJECT,patientId:HCC_PATIENT_ID};
const question='홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?';
const main=await helper.ask(principal,{question});assert.equal(main.status,'SYNTHETIC_SCENARIO');assert.equal(main.generationUsed,false);
assert.equal(main.scenarioEvidence.records.length,7);assert.match(main.answer,/간 효소 AST 32 U\/L/);assert.match(main.answer,/24\.6 ng\/mL/);
checks.push({test:'HCC_MAIN_QUESTION',result:'PASS',status:main.status,evidenceRecords:7});
const afp=await helper.ask(principal,{question:'AFP 검사는 무엇을 확인하나요?'});assert.equal(afp.status,'GENERATED');assert.equal(afp.generationUsed,true);
assert.equal(afp.profile,'SCHOOL_DEMO_TRANSLATION_RAG');assert.equal(afp.answer,afp.sources[0].excerpt);assert.match(afp.sources[0].reviewNote,/HOLD/);
assert.doesNotMatch(afp.answer+afp.sources.map(source=>source.contextNote).join(' '),/QA|HOLD|UNASSIGNED|색인 PASS|미해결 이슈/);
const offlineRag=await createPatientTranslationRag({env:{...process.env,HIPASS_HEALTH_HELPER_TRANSLATION_RAG:'school-demo'},generateAnswer:async()=>{throw Error('offline');}});
const fallback=await offlineRag('AFP 검사는 무엇을 확인하나요?',{signal:new AbortController().signal});
assert.equal(fallback.status,'SOURCE_GUIDANCE');assert.match(fallback.answer,/관련 원문 자료/);
assert.doesNotMatch(fallback.answer+fallback.sources.map(source=>source.contextNote).join(' '),/QA|HOLD|UNASSIGNED|색인 PASS|미해결 이슈/);
assert.ok(fallback.sources.every(source=>!source.excerpt&&!source.listContexts));
checks.push({test:'PATIENT_COPY_AND_HELD_FALLBACK',result:'PASS'});
checks.push({test:'AZURE_TO_PRIVATE_QWEN_TRANSLATION',result:'PASS',status:afp.status,generationUsed:afp.generationUsed,sourceCount:afp.sources.length});
const clinical=await helper.ask(principal,{question:'내 AFP로 간암인지 진단해 주세요'});assert.equal(clinical.status,'REFUSED');assert.deepEqual(clinical.sources,[]);
checks.push({test:'PERSONAL_DIAGNOSIS_REFUSAL',result:'PASS'});
await assert.rejects(helper.ask({...principal,role:'DOCTOR'},{question:'AFP 설명'}),/HELPER_PATIENT_REQUIRED/);
await assert.rejects(helper.ask(principal,{question:'AFP 설명',patientId:'other'}),/HELPER_INPUT_INVALID/);
assert.ok(logs.some(row=>row.reasonCode==='HELPER_TRANSLATION_ANSWER_GENERATED'));assert.doesNotMatch(JSON.stringify(logs),/홍길동|24\.6|question|answer/);
checks.push({test:'ROLE_OVERRIDE_AND_AUDIT_MINIMIZATION',result:'PASS'});
console.log(JSON.stringify({result:'PASS',scope:'INSTALLED_SERVICE_WITH_SYNTHETIC_TEST_PRINCIPAL',liveEntraBrowser:'NOT VERIFIED',checks}));
process.exit(0);
'''
def main(folder):
 folder=folder.resolve();assert folder.is_relative_to(ROOT/'artifacts/azure');manifest=json.loads((folder/'manifest.json').read_text())
 client=release.runtime.connect('CLOUD',None)
 try:
  program='MANIFEST='+repr(manifest)+'\nJS='+repr(JS)+r'''
import json,subprocess,hashlib
def run(args):return subprocess.check_output(args,stderr=subprocess.PIPE,timeout=100)
names={'control':'hp-capstone-control-control-1','web':'hp-public-web-web-1'}
for role,name in names.items():
 item=json.loads(run(['docker','inspect',name]))[0];assert item['Image']==MANIFEST['candidates'][role]
 for path,digest in MANIFEST['roles'][role]['hashes'].items():
  code="console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/'+process.argv[1])).digest('hex'))"
  assert run(['docker','exec',name,'/nodejs/bin/node','-e',code,path]).decode().strip()==digest
for old in MANIFEST['baseline'][2:]:
 current=json.loads(run(['docker','inspect',old['name']]))[0];assert current['Id']==old['id'] and current['Image']==old['image']
try:value=json.loads(run(['docker','exec','hp-capstone-control-control-1','/nodejs/bin/node','--input-type=module','-e',JS]))
except subprocess.CalledProcessError as error:
 print(json.dumps({'result':'FAIL','diagnostic':error.stderr.decode()[:2200]}));raise SystemExit(0)
value['installedHashes']='PASS';value['protectedContainers']='PASS';print(json.dumps(value))
'''
  result=release.runtime.remote(client,'CLOUD',None,program,120);(folder/'installed-rag-verify.json').write_text(json.dumps(result,indent=2));return result
 finally:client.close()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--folder',type=pathlib.Path,required=True);a=p.parse_args();result=main(a.folder);print(json.dumps(result));raise SystemExit(0 if result.get('result')=='PASS' else 1)
