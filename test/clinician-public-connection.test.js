import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {dataPlaneProofOrigin} from '../src/data-plane-authorization.js';
const image='https://highpass-images-b.japaneast.cloudapp.azure.com';
test('only configured exact HTTPS imaging alias can choose DPoP URI; no authorization is inferred',()=>{
 const config={publicBaseUrl:'https://192.168.111.149:9443',clinicianPublicBaseUrl:image};
 const proof=htu=>'e30.'+Buffer.from(JSON.stringify({htu})).toString('base64url')+'.signature';
 assert.equal(dataPlaneProofOrigin({dpopProof:proof(image+'/dicomweb/studies')},config),image);
 for(const u of ['https://evil.test/dicomweb/studies',image+'/dicomweb/studies?token=x','http://highpass-images-b.japaneast.cloudapp.azure.com/dicomweb/studies',image+'/dicomweb/studies#x'])assert.equal(dataPlaneProofOrigin({dpopProof:proof(u)},config),config.publicBaseUrl);
 assert.equal(dataPlaneProofOrigin({dpopProof:proof(image+'/dicomweb/studies')},{...config,clinicianPublicBaseUrl:undefined}),config.publicBaseUrl);
});
test('browser proof uses actual external URL, fresh DPoP and omits cookies; download stays closed',async()=>{
 const app=readFileSync('public/app.js','utf8');const source=app.slice(app.indexOf('let proofKeyPromise;'),app.indexOf('function developmentPrincipalHeaders('));
 const requests=[];const origin='https://highpass-demo.japaneast.cloudapp.azure.com';
 const ctx={Headers,URL,crypto:webcrypto,TextEncoder,Uint8Array,AbortSignal,atob,btoa,location:{origin,hostname:new URL(origin).hostname},document:{documentElement:{dataset:{capstone:'1'}}},fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>({supported:true})};}};
 runInNewContext(source+';this.call=proofFetch;',ctx);
 const token='e30.'+Buffer.from(JSON.stringify({cnf:{jkt:'bound'}})).toString('base64url')+'.sig';
 await ctx.call('/dicomweb/studies/1.2/series/1.2.3/instances',{headers:{authorization:'Bearer '+token}});
 const request=requests[0],proof=JSON.parse(Buffer.from(request.opts.headers.get('dpop').split('.')[1],'base64url'));
 assert.equal(request.url,image+'/dicomweb/studies/1.2/series/1.2.3/instances');assert.equal(proof.htu,request.url);assert.equal(request.opts.credentials,'omit');assert.equal(request.opts.redirect,'error');assert.equal(request.opts.headers.get('authorization'),'DPoP '+token);
 await ctx.call('/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/download');assert.equal(requests[1].url,origin+'/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/download');
});
test('public clinician snapshot excludes admin and patient impersonation; context survives viewer entry',()=>{
 const app=readFileSync('public/app.js','utf8'),edge=readFileSync('scripts/start-public-web.js','utf8');
 const branch=app.slice(app.indexOf("  if(currentPersona==='DOCTOR'&&typeof location!=='undefined'&&location.hostname==='highpass-demo.japaneast.cloudapp.azure.com'){"),app.indexOf('  const auditParams ='));
 assert.match(branch,/api\/clinician\/receptions/);assert.doesNotMatch(branch,/audit-logs|patients\/|imaging-studies/);
 assert.match(app,/if\(currentPersona!=="DOCTOR"\)switchPersona\("DOCTOR"\)/);
 assert.match(edge,/clinician\\\/health-records/);assert.match(edge,/dicom-access\\\/request/);
});
