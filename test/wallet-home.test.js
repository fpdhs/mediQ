import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {walletConsentState} from '../public/ui/wallet-home.js';
const now=Date.parse('2026-10-11T12:00:00Z');
const valid={status:'ACTIVE',validFrom:'2026-10-11T11:00:00Z',validUntil:'2026-10-11T13:00:00Z'};

test('wallet keeps static card geometry under reduced motion and readable summary typography',()=>{
 const css=readFileSync(new URL('../public/ui/wallet-home.css',import.meta.url),'utf8');
 assert.match(css,/#patient-portal-app \.mq-wallet-card,\.mq-wallet-card:hover[\s\S]*rotate\(var\(--angle,0deg\)\)!important/);
 assert.match(css,/\.mq-wallet-row strong\{font-size:16px/);
 assert.match(css,/\.mq-wallet-row small\{font-size:14px/);
 const js=readFileSync(new URL('../public/ui/wallet-home.js',import.meta.url),'utf8');
 assert.ok(js.includes('salutation.textContent=`${name}님,`'));
 assert.ok(js.includes('다음 진료를 준비해요.'));
});
test('wallet artwork stays within the unchanged portal static limit and is included in PWA shell',()=>{
 const asset=new URL('../public/images/mediq-wallet-front-v1.webp',import.meta.url);
 assert.ok(statSync(asset).size<=2097152);
 assert.equal(readFileSync(asset).subarray(8,12).toString(),'WEBP');
 for(const file of ['../public/ui/wallet-home.js','../public/mobile/sw.js','../Dockerfile.wallet-ui'])assert.ok(readFileSync(new URL(file,import.meta.url),'utf8').includes('mediq-wallet-front-v1.webp'));
});
test('wallet distinguishes valid consent, exact expiry, revocation and unknown without asserting receipt',()=>{
 assert.equal(walletConsentState(valid,now),'공유 동의 유효');
 assert.equal(walletConsentState(valid,Date.parse(valid.validUntil)),'기간 만료');
 assert.equal(walletConsentState({...valid,status:'REVOKED'},now),'공유 중단');
 assert.equal(walletConsentState({...valid,validFrom:'2026-10-12T00:00:00Z'},now),'상태 확인 필요');
 assert.equal(walletConsentState({...valid,validUntil:'invalid'},now),'상태 확인 필요');
 assert.equal(walletConsentState({...valid,status:'UNKNOWN'},now),'상태 확인 필요');
});
