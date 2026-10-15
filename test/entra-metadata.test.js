import test from 'node:test';
import assert from 'node:assert/strict';
import {createEntraMetadataFetch,createEntraMetadataServer,metadataRoutes} from '../src/entra-metadata.js';
const tenant='11111111-1111-4111-8111-111111111111';
test('metadata adapter only routes exact public metadata and strips credentials',async()=>{
  let actual;const fetcher=createEntraMetadataFetch({ENTRA_TENANT_ID:tenant,HIPASS_ENTRA_METADATA_ORIGIN:'http://entra-metadata:8080'},async(url,opts)=>{actual={url,opts};return new Response('{}');});
  await fetcher(metadataRoutes(tenant).get('/discovery'),{headers:{authorization:'sensitive'}});
  assert.equal(actual.url,'http://entra-metadata:8080/discovery');
  assert.deepEqual(actual.opts.headers,{accept:'application/json'});
  for(const url of ['http://169.254.169.254/metadata','https://example.com','https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0/token'])assert.throws(()=>fetcher(url),/DENIED/);
  assert.throws(()=>createEntraMetadataFetch({HIPASS_ENTRA_METADATA_ORIGIN:'http://evil'}),/ORIGIN_INVALID/);
});
test('actual metadata listener denies arbitrary URL, credential and method; upstream failure is 503',async t=>{
  let calls=0;const server=createEntraMetadataServer({tenant,fetchImpl:async()=>{calls++;return new Response(JSON.stringify({keys:[]}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
  const origin='http://127.0.0.1:'+server.address().port;
  const get=(path,opts={})=>fetch(origin+path,{...opts,signal:AbortSignal.timeout(3000)});
  assert.equal((await get('/common-keys')).status,200);
  for(const [path,opts] of [['/common-keys?url=x',{}],['/arbitrary',{}],['/common-keys',{method:'POST'}],['/common-keys',{headers:{authorization:'test'}}],['/common-keys',{headers:{cookie:'test=1'}}]])assert.equal((await get(path,opts)).status,403);
  assert.equal(calls,1);
  assert.equal((await get('/discovery')).status,503);
});
