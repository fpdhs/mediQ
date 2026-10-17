"""Capture immutable deployed image code for an authentication-only candidate."""
import argparse, base64, difflib, hashlib, importlib.util, json, pathlib, subprocess, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE={'control':'sha256:3d1cb6c2d7dfcaf33d1cefd13b89055ac58e6a5ab349808352862fbe08895436',
      'portal':'sha256:2c09773d13276396ba5d2a6084293aec16809ce17c09b59a263b0cb2603931e0'}
FILES={'control':['src/auth.js','src/oidc-jwks.js','src/server.js','scripts/start-capstone-control.js','src/capstone-patient-runtime-config.js'],
       'portal':['src/capstone-b-portal.js','scripts/start-capstone-b-portal.js','public/capstone-auth.js']}
def run(args,timeout=90):
    return subprocess.check_output(args,cwd=ROOT,timeout=timeout,stderr=subprocess.PIPE)
def image_files(image,names):
    js="const fs=require('fs');let o={};for(const f of JSON.parse(process.argv[1]))o[f]=fs.readFileSync('/app/'+f).toString('base64');console.log(JSON.stringify(o))"
    return {k:base64.b64decode(v) for k,v in json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',image,'-e',js,json.dumps(names)])).items()}
def once(text,old,new):
    if text.count(old)!=1:raise RuntimeError('EXACT_AUTH_PATCH_ANCHOR_REQUIRED')
    return text.replace(old,new,1)
def build(folder):
    folder=folder.resolve()
    assert folder.is_relative_to((ROOT/'artifacts/azure').resolve())
    capture=json.loads((folder/'capture.json').read_text())
    outputs={};attempt=uuid.uuid4().hex[:8]
    for role in ['control','portal']:
        context=folder/role/('candidate-'+attempt);context.mkdir(exist_ok=False)
        files={}
        if role=='control':
            names=['src/auth.js','src/oidc-jwks.js','src/entra-metadata.js','src/capstone-control-runtime-config.js',
                   'scripts/start-capstone-control.js','src/capstone-patient-runtime-config.js','scripts/start-entra-metadata.js']
            files.update({name:(ROOT/name).read_bytes() for name in names})
            s=(folder/role/'baseline/src/server.js').read_text(encoding='utf8')
            local=(ROOT/'src/server.js').read_text(encoding='utf8')
            s=once(s,'  canReadAuditLogs,','  canReadAuditLogs,\n  createAuthenticationProvider,')
            s=once(s,'isHccCatalogCommitted, HCC_PATIENT_ID }','isHccCatalogCommitted, HCC_PATIENT_ID, HCC_PRESENTATION, HCC_STUDY_UID }')
            s=once(s,'function authenticateRequest(request) {','async function authenticateRequest(request) {')
            s=once(s,'const principal = authenticateBaseRequest(request);','const principal = await authenticateBaseRequest(request, process.env, authProvider);')
            s=once(s,'validateAuthConfiguration(process.env);','validateAuthConfiguration(process.env);\nconst authProvider = createAuthenticationProvider(process.env);')
            s=s.replace('= authenticateRequest(request);','= await authenticateRequest(request);')
            start=local.index('      const authenticationFailure =')
            end=local.index("      if (error.code === 'DEMO_PROFILE_ARCHIVED')",start)
            s=once(s,"      if (error.code === 'DEMO_PROFILE_ARCHIVED')",local[start:end]+"      if (error.code === 'DEMO_PROFILE_ARCHIVED')")
            start=local.index('async function persistAuthenticationAudit()')
            end=local.index('async function routeApi',start)
            s=once(s,'async function routeApi',local[start:end]+'async function routeApi')
            start=local.index('  if (method === "GET" && url.pathname === "/api/capstone-demo/auth-config")')
            end=local.index("  if (method === 'GET' && url.pathname === '/api/capstone-demo/scenario')",start)
            s=once(s,"  if (method === 'GET' && url.pathname === '/api/capstone-demo/scenario')",local[start:end]+"  if (method === 'GET' && url.pathname === '/api/capstone-demo/scenario')")
            s=once(s,'createPrivacyHttpHandler({ service: privacyService, timeoutMs:', 'createPrivacyHttpHandler({ service: privacyService, env: process.env, provider: authProvider, timeoutMs:')
            privacy=image_files(capture['roles'][role]['base'],['src/privacy-http-handler.js'])['src/privacy-http-handler.js'].decode().replace('\r\n','\n')
            privacy=once(privacy,'env = process.env, timeoutMs','env = process.env, provider = null, timeoutMs')
            privacy=once(privacy,'principal = authenticateRequest(request, env);','principal = await authenticateRequest(request, env, provider);')
            files['src/privacy-http-handler.js']=privacy.encode()
            grant=image_files(capture['roles'][role]['base'],['src/patient-self-view-grant-runtime.js'])['src/patient-self-view-grant-runtime.js'].decode()
            grant=once(grant,"env.AUTH_MODE!=='TEST'","!['TEST','ENTRA_OIDC'].includes(env.AUTH_MODE)")
            files['src/patient-self-view-grant-runtime.js']=grant.encode()
            files['src/server.js']=s.encode()
        else:
            names=['public/capstone-auth.js','public/entra-auth.js','public/entra-redirect.html','public/vendor/msal-browser.js','public/vendor/entra-redirect.js']
            files.update({name:(ROOT/name).read_bytes() for name in names})
            s=(folder/role/'baseline/src/capstone-b-portal.js').read_text(encoding='utf8')
            s=once(s,'patientSelfViewEnabled=false,patientImageDecryption })','patientSelfViewEnabled=false,patientImageDecryption,entraLoginEnabled=false })')
            old=next(line for line in s.splitlines() if 'response.setHeader("content-security-policy"' in line)
            new="    const entraConnect = entraLoginEnabled === true ? ' https://login.microsoftonline.com' : '';\n"+old.replace(', "default-src',', `default-src').replace('base-uri \'self\'");','base-uri \'self\'`);').replace("connect-src 'self';","connect-src 'self'${entraConnect};")
            s=once(s,old,new);files['src/capstone-b-portal.js']=s.encode()
            s=(folder/role/'baseline/scripts/start-capstone-b-portal.js').read_text(encoding='utf8')
            s=once(s,'diagnosticFactory: createRuntimeDiagnosticFactory(process.env)',"entraLoginEnabled: process.env.CAPSTONE_ENTRA_LOGIN_ENABLED === '1', diagnosticFactory: createRuntimeDiagnosticFactory(process.env)")
            files['scripts/start-capstone-b-portal.js']=s.encode()
        for name,data in files.items():
            p=context/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        base=capture['roles'][role]['base']
        base_tag='highpass-entra-base:'+base.removeprefix('sha256:')
        run(['docker','tag',base,base_tag])
        assert json.loads(run(['docker','image','inspect',base_tag]))[0]['Id']==base
        (context/'Dockerfile').write_text('FROM '+base_tag+'\n'+''.join('COPY '+name+' /app/'+name+'\n' for name in files),encoding='utf8')
        tag='highpass-entra:'+role+'-'+folder.name.removeprefix('entra-web-').lower()+'-'+attempt
        result=subprocess.run(['docker','build','--network=none','--pull=false','-t',tag,str(context)],cwd=ROOT,capture_output=True,timeout=240)
        (folder/role/('build-'+attempt+'.log')).write_bytes(result.stdout+result.stderr)
        if result.returncode:raise RuntimeError('CANDIDATE_BUILD_FAILED')
        info=json.loads(run(['docker','image','inspect',tag]))[0]
        assert info['Config']==capture['roles'][role]['config'],'INHERITED_CONFIG_CHANGED'
        assert info['RootFS']['Layers'][:len(capture['roles'][role]['layers'])]==capture['roles'][role]['layers']
        outputs[role]={'image':info['Id'],'base':base,'context':str(context),'hashes':{name:hashlib.sha256(data).hexdigest() for name,data in files.items()}}
        actual=image_files(info['Id'],list(files))
        assert all(hashlib.sha256(actual[n]).hexdigest()==h for n,h in outputs[role]['hashes'].items())
    manifest=json.dumps({'review':'DRAFT / UNASSIGNED','deployed':False,'roles':outputs},indent=2)
    (folder/('candidate-'+attempt+'.json')).write_text(manifest,encoding='utf8')
    (folder/'candidate.json').write_text(manifest,encoding='utf8')
    print(json.dumps({'folder':str(folder),'images':{r:v['image'] for r,v in outputs.items()},'deployed':False}))
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--build-capture');args=parser.parse_args()
    if args.build_capture:return build(ROOT/args.build_capture)
    spec=importlib.util.spec_from_file_location('entra_config',ROOT/'scripts/entra-web-config.py')
    config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
    folder=config.protected_folder()
    manifest={'scope':'AUTHENTICATION_ONLY_CAPTURE','review':'DRAFT / UNASSIGNED','deployed':False,'roles':{}}
    for role,base in BASE.items():
        info=json.loads(run(['docker','image','inspect',base]))[0]
        assert info['Id']==base
        js="const fs=require('fs');let o={};for(const f of JSON.parse(process.argv[1])){try{o[f]=fs.readFileSync('/app/'+f).toString('base64')}catch(e){if(e.code!=='ENOENT')throw e;o[f]=null}}console.log(JSON.stringify(o))"
        data=json.loads(run(['docker','run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--entrypoint=/nodejs/bin/node',base,'-e',js,json.dumps(FILES[role])]))
        record={'base':base,'config':info['Config'],'layers':info['RootFS']['Layers'],'hashes':{},'diffLines':{}}
        for name,encoded in data.items():
            if encoded is None: continue
            raw=base64.b64decode(encoded)
            target=folder/role/'baseline'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            record['hashes'][name]=hashlib.sha256(raw).hexdigest()
            local=(ROOT/name).read_text(encoding='utf8')
            diff=''.join(difflib.unified_diff(raw.decode().splitlines(True),local.splitlines(True),fromfile='baseline/'+name,tofile='workspace/'+name))
            target=folder/role/'diff'/ (name+'.diff');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(diff,encoding='utf8')
            record['diffLines'][name]=len(diff.splitlines())
        manifest['roles'][role]=record
    (folder/'capture.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    print(json.dumps({'folder':str(folder),'diffLines':{r:x['diffLines'] for r,x in manifest['roles'].items()}}))
if __name__=='__main__':main()
