import test from 'node:test';
import assert from 'node:assert/strict';
import {createEntraRedirectLogin} from '../public/entra-auth.js';
const origin='https://demo.example';
const config={provider:'ENTRA_OIDC',synthetic:true,tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',redirectUri:origin+'/entra-redirect.html',scopes:['api://33333333-3333-4333-8333-333333333333/access_as_user']};
test('redirect is explicit, resumes first, keeps tokens in memory',async()=>{
 let options,request,started=0,cleared=0;
 class Client{constructor(o){options=o;}async initialize(){}async clearCache(){cleared++;}async handleRedirectPromise(){return null;}async loginRedirect(r){request=r;started++;}}
 const login=await createEntraRedirectLogin({config,appOrigin:origin,msalModule:{PublicClientApplication:Client}});
 assert.equal(await login.resume(),null);assert.equal(started,0);
 await login.start();assert.equal(started,1);assert.equal(cleared,1);assert.equal(options.cache.cacheLocation,'sessionStorage');assert.equal(request.redirectUri,config.redirectUri);
 assert.equal(request.redirectStartPage,origin+'/hipass/');
});
test('mobile redirect explicitly returns to mobile home',async()=>{
 let request;
 class Client {async initialize(){} async loginRedirect(r){request=r;}}
 const login=await createEntraRedirectLogin({config,appOrigin:origin,pathname:'/mobile/',msalModule:{PublicClientApplication:Client}});
 await login.start();assert.equal(request.redirectStartPage,origin+'/mobile/');
});
test('security-admin intent returns to the fixed portal home without trusting a URL target',async()=>{
 let request;
 class Client {async initialize(){} async loginRedirect(r){request=r;}}
 const login=await createEntraRedirectLogin({config,appOrigin:origin,pathname:'/hipass/',msalModule:{PublicClientApplication:Client}});
 await login.start('SECURITY_ADMIN');
 assert.equal(request.redirectStartPage,origin+'/hipass/?loginIntent=security');
});
test('redirect identity rejection never returns an authenticated session',async()=>{
 class Client{async initialize(){}async clearCache(){}async handleRedirectPromise(){return {accessToken:'synthetic-token',expiresOn:new Date(Date.now()+60000)};}}
 const login=await createEntraRedirectLogin({config,appOrigin:origin,msalModule:{PublicClientApplication:Client},fetchImpl:async()=>({ok:false})});
 await assert.rejects(login.resume(),/ENTRA_IDENTITY_DENIED/);
});
