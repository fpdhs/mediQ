# Invoked by scenario-health-release.py over the existing pinned SSH connection.
import subprocess,json,pathlib,os,time,hashlib
folder=pathlib.Path(MANIFEST['stage'])
assert str(folder).startswith('/home/highpassadmin/.highpass-records-')
def run(args,timeout=120,env=None):
    result=subprocess.run(args,capture_output=True,timeout=timeout,env=env)
    if result.returncode:
        log=folder/(PHASE+'-error.log');log.write_bytes(result.stdout+result.stderr);log.chmod(0o600)
        raise RuntimeError('COMMAND_FAILED_'+args[0])
    return result.stdout
def inspect(name):return json.loads(run(['docker','inspect',name]))[0]
def save(name,obj):
    p=folder/name;p.write_text(json.dumps(obj));p.chmod(0o600)
def config_for(old,project):
    labels=old['Config']['Labels'];cmd=['docker','compose','--project-directory',labels['com.docker.compose.project.working_dir'],'-p',project]
    for file in labels['com.docker.compose.project.config_files'].split(','):cmd+=['-f',file]
    env=dict(os.environ);env.update(v.split('=',1) for v in old['Config']['Env'])
    env.update(HIPASS_APP_IMAGE=old['Image'],HIPASS_POSTGRES_IMAGE=inspect('hp-capstone-control-postgres-1')['Image'],HIPASS_CLOUD_SECRET_DIR='/opt/highpass/capstone-control-secrets',HIPASS_CAPSTONE_PUBLIC_ORIGIN='https://192.168.111.149:9443')
    config=json.loads(run(cmd+['config','--format','json'],env=env))
    service='web' if project=='hp-public-web' else 'control'
    assert config['services'][service]['image']==old['Image'],'COMPOSE_DRIFT'
    actual=dict(v.split('=',1) for v in old['Config']['Env'])
    # Compose re-interprets '$' in stored password hashes. Pin the current
    # container environment verbatim, escaped for the next Compose read.
    # This protected file is never emitted to stdout or committed.
    config['services'][service]['environment']={k:v.replace('$','$$') for k,v in actual.items()}
    return config
def switch(role,file):
    run(['docker','compose','-p','hp-public-web' if role=='web' else 'hp-capstone-control','-f',str(file),'up','-d','--no-deps','--pull','never',role])
names={'control':'hp-capstone-control-control-1','web':'hp-public-web-web-1'}
if PHASE=='build':
    candidates={}
    for role,item in MANIFEST['roles'].items():
        assert inspect(names[role])['Image']==item['base'],'BASELINE_CHANGED'
        for name,digest in item['hashes'].items():assert hashlib.sha256((folder/role/name).read_bytes()).hexdigest()==digest
        tag='highpass-records-'+role+':'+folder.name.removeprefix('.highpass-records-').lower()
        base_tag='highpass-records-base:'+item['base'][7:23]
        run(['docker','tag',item['base'],base_tag])
        run(['chmod','-R','a+rX',str(folder/role/('src' if role=='control' else 'public'))])
        (folder/role/'Dockerfile').write_text('FROM '+base_tag+'\nCOPY --chmod=755 '+('src/ /app/src/' if role=='control' else 'public/ /app/public/')+'\n')
        run(['docker','build','--network=none','--pull=false','-t',tag,str(folder/role)],300)
        image=inspect(tag);base=inspect(item['base']);assert image['Config']==base['Config'],'RUNTIME_CHANGED'
        assert image['RootFS']['Layers'][:-1]==base['RootFS']['Layers'],'BASE_LAYERS_CHANGED'
        # All overlaid source files must parse in their real production image.
        for name in item['hashes']:
            if name.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL',image['Id'],'--check','/app/'+name])
        candidates[role]=image['Id']
    test_cmd=['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true']
    # Overlay the corresponding web files only in the isolated test container.
    run(['chmod','-R','a+rX',str(folder/'web'/'public')])
    for name in MANIFEST['roles']['web']['hashes']:
        test_cmd+=['-v',str(folder/'web'/name)+':/app/'+name+':ro']
    test_cmd+=['-v',str(folder/'tests')+':/app/test:ro',candidates['control'],'--test','/app/test/scenario-health-standard.test.js']
    result=run(test_cmd);(folder/'candidate-tests.log').write_bytes(result)
    print(json.dumps(candidates))
elif PHASE=='deploy':
    for expected in MANIFEST['baseline']:
        actual=inspect(expected['name']);assert actual['Id']==expected['id'] and actual['Image']==expected['image'],'BASELINE_CHANGED'
    old={role:inspect(name) for role,name in names.items()}
    for role in names:
        config=config_for(old[role],'hp-public-web' if role=='web' else 'hp-capstone-control')
        save(role+'-before.json',config);config['services'][role]['image']=MANIFEST['candidates'][role];save(role+'-after.json',config)
    changed=[]
    try:
        for role in ['control','web']:
            changed.append(role);switch(role,folder/(role+'-after.json'))
            for attempt in range(40):
                current=inspect(names[role]);health=current['State'].get('Health',{}).get('Status')
                if current['State']['Running'] and (role=='web' or health=='healthy'):break
                time.sleep(1)
            assert current['State']['Running'] and (role=='web' or health=='healthy'),'UNHEALTHY'
            assert current['Image']==MANIFEST['candidates'][role]
            assert dict(v.split('=',1) for v in current['Config']['Env'])==dict(v.split('=',1) for v in old[role]['Config']['Env']),'ENV_CHANGED'
            for key in ['User','Entrypoint','Cmd']:assert current['Config'][key]==old[role]['Config'][key],'RUNTIME_CHANGED'
            assert current['Mounts']==old[role]['Mounts'],'MOUNTS_CHANGED'
            for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:assert current['HostConfig'][key]==old[role]['HostConfig'][key],'SECURITY_CHANGED'
        for item in MANIFEST['baseline'][2:]:assert inspect(item['name'])['Id']==item['id'],'PROTECTED_CONTAINER_CHANGED'
    except Exception:
        for role in reversed(changed):switch(role,folder/(role+'-before.json'))
        raise
    print(json.dumps({'status':'PASS','images':MANIFEST['candidates'],'rollback':[str(folder/(r+'-before.json')) for r in names],'databasePacsIngressUnchanged':True}))
elif PHASE=='rollback':
    for role in ['web','control']:
        assert inspect(names[role])['Image']==MANIFEST['candidates'][role],'ROLLBACK_TARGET_CHANGED'
    for role in ['web','control']:switch(role,folder/(role+'-before.json'))
    print(json.dumps({'status':'PASS','restored':{r:inspect(names[r])['Image'] for r in names}}))
else:raise ValueError('UNKNOWN_PHASE')
