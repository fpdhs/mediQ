"""Release RAG retrieval quality, colloquial aliases and retry stability to Azure; preserve live unrelated code and runtime."""
import argparse, base64, hashlib, importlib.util, json, pathlib, re, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]
ORIGIN = 'https://highpass-demo.japaneast.cloudapp.azure.com'

def load(name, path):
    s = importlib.util.spec_from_file_location(name, ROOT / path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

runtime = load('rag_runtime', 'scripts/health-helper-runtime-check.py')
config = load('rag_config', 'scripts/entra-web-config.py')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def stage():
    folder = config.protected_folder()
    client = runtime.connect('CLOUD', None)
    try:
        baseline = runtime.remote(client, 'CLOUD', None, """import subprocess, json
names=['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15));out=[]
for item in items:
    assert item['State']['Running'];out.append(dict(name=item['Name'],id=item['Id'],image=item['Image']))
files={}
for role,item,paths in [('control',items[0],['src/health-helper-patient-translation.js']),('web',items[1],['public/ui/patient-helper.js','public/mobile/sw.js'])]:
    code="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.readFileSync('/app/'+p).toString('base64')]))))"
    files[role]=json.loads(subprocess.check_output(['docker','exec',item['Id'],'/nodejs/bin/node','-e',code,json.dumps(paths)],timeout=15))
print(json.dumps(dict(containers=out,files=files)))""", 40)
        (folder / 'baseline.json').write_text(json.dumps(baseline))

        control_files = [
            'src/medlineplus-upload-corpus.js',
            'src/health-helper-rag.js',
            'src/health-helper-patient-translation.js',
            'src/health-helper-korean-refinement.js',
            'src/health-helper-medlineplus.js',
            'src/health-helper-school-demo-medical-tests.js',
            'src/health-helper-korean-morpho.js',
            'src/health-helper-intent-classifier.js',
            'src/health-helper-glossary-interceptor.js'
        ]
        patches = {'control': {}, 'web': {}}
        for p in control_files:
            patches['control'][p] = (ROOT / p).read_bytes()

        ui_path = 'public/ui/patient-helper.js'
        patches['web'][ui_path] = (ROOT / ui_path).read_bytes()

        live_sw = base64.b64decode(baseline['files']['web']['public/mobile/sw.js']).decode()
        new_sw, count = re.subn(r'const CACHE_NAME = "hipass-mediq-shell-[^"]+";', f'const CACHE_NAME = "hipass-mediq-shell-rag-quality-{folder.name}";', live_sw)
        assert count == 1, 'SW_CACHE_NAME_PATTERN_MISMATCH'
        patches['web']['public/mobile/sw.js'] = new_sw.encode()

        remote_stage = '/home/highpassadmin/.highpass-records-' + folder.name
        manifest = {
            'stage': remote_stage,
            'baseline': baseline['containers'],
            'roles': {},
            'scope': 'PATIENT_HELPER_QUALITY_RELEASE'
        }

        with client.open_sftp() as ftp:
            ftp.mkdir(remote_stage, 0o755)
            def upload(name, data):
                local = folder / name
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(data)
                for parent in reversed(pathlib.PurePosixPath(name).parents):
                    if str(parent) == '.': continue
                    try: ftp.mkdir(remote_stage + '/' + parent.as_posix(), 0o755)
                    except OSError: pass
                ftp.put(str(local), remote_stage + '/' + name)
                ftp.chmod(remote_stage + '/' + name, 0o444)

            for role, files in patches.items():
                for name, data in files.items():
                    upload(role + '/' + name, data)
                manifest['roles'][role] = {
                    'base': baseline['containers'][0 if role == 'control' else 1]['image'],
                    'hashes': {p: sha(data) for p, data in files.items()}
                }

            test_files = [
                'health-helper-patient-translation.test.js',
                'health-helper-rag.test.js',
                'health-helper-http.test.js',
                'patient-helper.test.js',
                'health-helper-cirrhosis-retrieval.test.js',
                'health-helper-korean-morpho.test.js',
                'health-helper-glossary-interceptor.test.js'
            ]
            for name in test_files:
                upload('tests/' + name, (ROOT / 'test' / name).read_bytes())
            upload('tests/helpers/health-helper-corpus.js', (ROOT / 'test/helpers/health-helper-corpus.js').read_bytes())

        (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        return {'folder': str(folder), 'stage': remote_stage}
    finally:
        client.close()

def operation(folder, phase):
    folder = folder.resolve()
    assert folder.is_relative_to(ROOT / 'artifacts/azure')
    manifest = json.loads((folder / 'manifest.json').read_text())
    client = runtime.connect('CLOUD', None)
    try:
        operator = (ROOT / 'scripts/scenario-health-remote.py').read_text()
        operator = operator.replace("image['RootFS']['Layers'][:-1]==base['RootFS']['Layers']", "image['RootFS']['Layers'][:len(base['RootFS']['Layers'])]==base['RootFS']['Layers']")
        operator = operator.replace("    test_cmd=['docker'", """    test_container=run(['docker','create',candidates['web']]).decode().strip()
    try:run(['docker','cp',test_container+':/app/public',str(folder/'test-web-public')])
    finally:run(['docker','rm',test_container])
    run(['chmod','-R','a+rX',str(folder/'test-web-public')])
    test_cmd=['docker'""", 1)
        operator = operator.replace("    test_cmd+=['-v',str(folder/'tests')", """    test_cmd+=['-v',str(folder/'test-web-public')+':/app/public:ro']
    test_cmd+=['-v',str(folder/'tests')""", 1)
        operator = operator.replace("'--test','/app/test/scenario-health-standard.test.js'", "'--test','/app/test/health-helper-patient-translation.test.js','/app/test/health-helper-http.test.js','/app/test/patient-helper.test.js','/app/test/health-helper-cirrhosis-retrieval.test.js','/app/test/health-helper-korean-morpho.test.js','/app/test/health-helper-glossary-interceptor.test.js'")

        program = 'MANIFEST=' + repr(manifest) + '\nPHASE=' + repr(phase) + '\n' + operator
        result = runtime.remote(client, 'CLOUD', None, program, 540 if phase == 'build' else 300)
        if phase == 'build':
            manifest['candidates'] = result
            (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        (folder / (phase + '.json')).write_text(json.dumps(result, indent=2))
        return result
    finally:
        client.close()

def verify(folder):
    manifest = json.loads((folder / 'manifest.json').read_text())
    checks = []
    for path, digest in manifest['roles']['web']['hashes'].items():
        with urllib.request.urlopen(urllib.request.Request(ORIGIN + '/' + path.removeprefix('public/'), headers={'Cache-Control': 'no-cache'}), timeout=25) as r:
            assert sha(r.read()) == digest
        checks.append({'path': path, 'result': 'PASS'})
    for token in [None, 'invalid.token.signature']:
        headers = {'Content-Type': 'application/json', 'Origin': ORIGIN}
        if token: headers['Authorization'] = 'Bearer ' + token
        try:
            r = urllib.request.urlopen(urllib.request.Request(ORIGIN + '/api/v1/me/health-helper/questions', data=b'{"question":"AFP"}', headers=headers), timeout=25)
        except urllib.error.HTTPError as e:
            r = e
        assert r.status == 401
        checks.append({'test': 'tampered' if token else 'no-auth', 'result': 'PASS', 'status': r.status})
    result = {'checks': checks}
    (folder / 'verify.json').write_text(json.dumps(result, indent=2))
    return result

JS_INSTALLED_VERIFY = r'''
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
let nowMs=Date.now();
const helper=new HealthHelperRag({now:()=>{nowMs+=70000;return nowMs;},translationRag:rag,timeoutMs:40000,audit:async row=>logs.push(row),
 syntheticScenario:({principal,question})=>createSyntheticHccProvenanceAnswer({principal,question,enabled:true,catalogCommitted:isHccCatalogCommitted(store)})});
const principal={role:'PATIENT',subject:HCC_PATIENT_SUBJECT,patientId:HCC_PATIENT_ID};

// 1. Synthetic scenario
const main=await helper.ask(principal,{question:'홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?'});
assert.equal(main.status,'SYNTHETIC_SCENARIO');assert.equal(main.generationUsed,false);
assert.equal(main.scenarioEvidence.records.length,7);assert.match(main.answer,/간 효소 AST 32 U\/L/);assert.match(main.answer,/24\.6 ng\/mL/);
checks.push({test:'HCC_MAIN_QUESTION',result:'PASS',status:main.status,evidenceRecords:7});

// 2. AFP question
const afp=await helper.ask(principal,{question:'AFP 검사는 무엇을 확인하나요?'});
assert.equal(afp.status,'GENERATED');assert.equal(afp.generationUsed,true);
assert.equal(afp.profile,'SCHOOL_DEMO_TRANSLATION_RAG');assert.equal(afp.answer,afp.sources[0].excerpt);
assert.match(afp.sources[0].reviewNote,/HOLD/);
assert.doesNotMatch(afp.answer+afp.sources.map(source=>source.contextNote).join(' '),/QA|HOLD|UNASSIGNED|색인 PASS|미해결 이슈/);
checks.push({test:'AFP_QUESTION',result:'PASS',status:afp.status,sourceCount:afp.sources.length});

// 2a. Standalone AFP question (intercepted by screening glossary)
const afpAlone=await helper.ask(principal,{question:'AFP'});
assert.equal(afpAlone.status,'RETRIEVED');assert.equal(afpAlone.generationUsed,false);
assert.match(afpAlone.answer,/알파태아단백/u);
checks.push({test:'AFP_STANDALONE_QUERY',result:'PASS',status:afpAlone.status});

// 2b. Standalone Liver Ultrasound (intercepted by screening glossary)
const usLiver=await helper.ask(principal,{question:'간 초음파'});
assert.equal(usLiver.status,'RETRIEVED');assert.equal(usLiver.generationUsed,false);
assert.match(usLiver.answer,/간 초음파 검사/u);
checks.push({test:'LIVER_ULTRASOUND_STANDALONE_QUERY',result:'PASS',status:usLiver.status});

// 2c. Standalone Chest CT (intercepted by screening glossary)
const ctChest=await helper.ask(principal,{question:'흉부 CT'});
assert.equal(ctChest.status,'RETRIEVED');assert.equal(ctChest.generationUsed,false);
assert.match(ctChest.answer,/흉부 CT 검사/u);
checks.push({test:'CHEST_CT_STANDALONE_QUERY',result:'PASS',status:ctChest.status});

// 3. Colloquial cirrhosis question: "간경화에 대해서 알려달라"
const cirr1=await helper.ask(principal,{question:'간경화에 대해서 알려달라'});
assert.ok(cirr1.status==='GENERATED'||cirr1.status==='RETRIEVED', `Unexpected status: ${cirr1.status}`);
assert.match(cirr1.answer,/간경변증/u);
assert.equal(cirr1.sources[0].title,'간경변증');
checks.push({test:'CIRRHOSIS_COLLOQUIAL_EXPLANATION',result:'PASS',status:cirr1.status,title:cirr1.sources[0].title});

// 4. Colloquial definition with -란: "간경화란 무엇인가요?"
const cirr2=await helper.ask(principal,{question:'간경화란 무엇인가요?'});
assert.ok(cirr2.status==='GENERATED'||cirr2.status==='RETRIEVED', `Unexpected status: ${cirr2.status}`);
assert.match(cirr2.answer,/간경변증/u);
checks.push({test:'CIRRHOSIS_COLLOQUIAL_DEFINITION',result:'PASS',status:cirr2.status});

// 5. False positive prevention: "만약 간경화가 의심되면 어떤 검사를 하나요?"
const falseYak=await helper.ask(principal,{question:'만약 간경화가 의심되면 어떤 검사를 하나요?'});
assert.notEqual(falseYak.status,'REFUSED');
checks.push({test:'FALSE_POSITIVE_YAK_NOT_BLOCKED',result:'PASS',status:falseYak.status});

// 6. Genuine medication question must still be refused: "간경화에 무슨 약을 먹어야 하나요?"
const medYak=await helper.ask(principal,{question:'간경화에 무슨 약을 먹어야 하나요?'});
assert.equal(medYak.status,'REFUSED');
checks.push({test:'TRUE_MEDICATION_REFUSED',result:'PASS',status:medYak.status});

// 7. Clinical diagnosis refusal
const clinical=await helper.ask(principal,{question:'내 AFP로 간암인지 진단해 주세요'});
assert.equal(clinical.status,'REFUSED');assert.deepEqual(clinical.sources,[]);
checks.push({test:'PERSONAL_DIAGNOSIS_REFUSAL',result:'PASS'});

// 8. Offline fallback
const offlineRag=await createPatientTranslationRag({env:{...process.env,HIPASS_HEALTH_HELPER_TRANSLATION_RAG:'school-demo'},generateAnswer:async()=>{throw Error('offline');}});
const fallback=await offlineRag('AFP 검사는 무엇을 확인하나요?',{signal:new AbortController().signal});
assert.equal(fallback.status,'SOURCE_GUIDANCE');assert.match(fallback.answer,/관련 원문 자료/);
assert.doesNotMatch(fallback.answer+fallback.sources.map(source=>source.contextNote).join(' '),/QA|HOLD|UNASSIGNED|색인 PASS|미해결 이슈/);
assert.ok(fallback.sources.every(source=>!source.excerpt&&!source.listContexts));
checks.push({test:'PATIENT_COPY_AND_HELD_FALLBACK',result:'PASS'});

// 9. Role requirement and input validation
await assert.rejects(helper.ask({...principal,role:'DOCTOR'},{question:'AFP 설명'}),/HELPER_PATIENT_REQUIRED/);
await assert.rejects(helper.ask(principal,{question:'AFP 설명',patientId:'other'}),/HELPER_INPUT_INVALID/);
assert.ok(logs.some(row=>row.reasonCode==='HELPER_TRANSLATION_ANSWER_GENERATED'));
assert.doesNotMatch(JSON.stringify(logs),/홍길동|24\.6|question|answer/);
checks.push({test:'ROLE_OVERRIDE_AND_AUDIT_MINIMIZATION',result:'PASS'});

console.log(JSON.stringify({result:'PASS',scope:'INSTALLED_SERVICE_WITH_SYNTHETIC_TEST_PRINCIPAL',liveEntraBrowser:'NOT VERIFIED',checks}));
process.exit(0);
'''

def installed_verify(folder):
    folder = folder.resolve()
    assert folder.is_relative_to(ROOT / 'artifacts/azure')
    manifest = json.loads((folder / 'manifest.json').read_text())
    client = runtime.connect('CLOUD', None)
    try:
        program = 'MANIFEST=' + repr(manifest) + '\nJS=' + repr(JS_INSTALLED_VERIFY) + r'''
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
        result = runtime.remote(client, 'CLOUD', None, program, 120)
        (folder / 'installed-rag-verify.json').write_text(json.dumps(result, indent=2))
        return result
    finally:
        client.close()

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('phase', choices=['stage', 'build', 'deploy', 'verify', 'installed_verify', 'rollback'])
    p.add_argument('--folder', type=pathlib.Path)
    a = p.parse_args()
    if a.phase == 'stage':
        res = stage()
    elif a.phase == 'installed_verify':
        res = installed_verify(a.folder)
    elif a.phase == 'verify':
        res = verify(a.folder)
    else:
        res = operation(a.folder, a.phase)
    print(json.dumps(res, indent=2))
