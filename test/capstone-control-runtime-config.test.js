import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validateCapstoneControlRuntime} from '../src/capstone-control-runtime-config.js';

const baseline = {NODE_ENV:'production',AUTH_MODE:'TEST',HIPASS_CONTROL_PLANE_ONLY:'1',HIPASS_DPOP_REQUIRED:'1',HIPASS_STORE:'postgres'};
const entra = {...baseline,AUTH_MODE:'ENTRA_OIDC',ENTRA_TENANT_ID:'11111111-1111-4111-8111-111111111111',
  ENTRA_SPA_CLIENT_ID:'22222222-2222-4222-8222-222222222222',ENTRA_API_AUDIENCE:'33333333-3333-4333-8333-333333333333',
  ENTRA_API_SCOPE:'access_as_user',ENTRA_REDIRECT_URI:'https://demo.example/entra-redirect.html',HIPASS_PUBLIC_BASE_URL:'https://demo.example',
  HIPASS_ENTRA_ACTOR_MAP_FILE:'/run/config/entra-actors.json'};
test('TEST baseline and explicitly configured Entra retain cloud boundaries',()=>{
  validateCapstoneControlRuntime(baseline);validateCapstoneControlRuntime(entra);
});
test('Entra never permits Mock IdP fallback or incomplete configuration',()=>{
  assert.throws(()=>validateCapstoneControlRuntime({...entra,HIPASS_CAPSTONE_MOCK_IDP:'1'}),/ENTRA_MOCK_IDP_FORBIDDEN/);
  assert.throws(()=>validateCapstoneControlRuntime({...baseline,AUTH_MODE:'ENTRA_OIDC'}),/ENTRA_TENANT_ID is required/);
});
test('neither authentication mode can disable DPoP or Control boundary',()=>{
  for(const env of [baseline,entra])for(const invalid of [{HIPASS_DPOP_REQUIRED:'0'},{HIPASS_CONTROL_PLANE_ONLY:'0'},{HIPASS_STORE:'json'},{AUTH_MODE:'DEVELOPMENT_MOCK'}]){
    assert.throws(()=>validateCapstoneControlRuntime({...env,...invalid}),/cloud boundary/);
  }
});

test('Entra Compose merges private networks without publishing API or DB',()=>{
  const env={...process.env,HIPASS_APP_IMAGE:'highpass:test',HIPASS_POSTGRES_IMAGE:'postgres:16-alpine',
    HIPASS_CLOUD_SECRET_DIR:'/opt/highpass/secrets',HIPASS_CAPSTONE_PUBLIC_ORIGIN:'https://192.168.111.149:9443',
    HIPASS_ENTRA_CONFIG_DIR:'/opt/highpass/entra',HIPASS_ENTRA_METADATA_IMAGE:'highpass:metadata-test',...entra};
  const config=JSON.parse(execFileSync('docker',['compose','--project-directory',process.cwd(),'-f','infra/azure/capstone-control.compose.yml',
    '-f','infra/azure/capstone-control-entra.compose.yml','config','--format','json'],{env,encoding:'utf8',timeout:15000,windowsHide:true,stdio:'pipe'}));
  assert.deepEqual(Object.keys(config.services.control.networks).sort(),['api_private','db_private','entra_metadata_private']);
  assert.equal(config.networks.entra_metadata_private.internal,true);
  assert.equal(config.services['entra-metadata'].ports,undefined);
  assert.equal(config.services['entra-metadata'].volumes,undefined);
  assert.equal(config.networks.db_private.internal,true);
  assert.equal(config.networks.api_private.internal,true);
  assert.equal(config.services.control.environment.AUTH_MODE,'ENTRA_OIDC');
  assert.equal(config.services.control.environment.HIPASS_CAPSTONE_MOCK_IDP,'0');
  assert.equal(config.services.control.environment.HIPASS_DPOP_REQUIRED,'1');
  assert.equal(config.services.control.ports,undefined);
  assert.equal(config.services.postgres.ports,undefined);
  const mapping=config.services.control.volumes.find(v=>v.target==='/run/config/entra-actors.json');
  assert.equal(mapping.read_only,true);
});
