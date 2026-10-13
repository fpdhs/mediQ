import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
test('open wallet has hardware-free material, passive pockets and readable helper action',()=>{
 const css=readFileSync('public/ui/wallet-open.css','utf8');
 assert.match(css,/mediq-wallet-leather-v1/);
 assert.doesNotMatch(css,/mediq-wallet-front/);
 assert.match(css,/health-record-guide .*health-wallet-back/);
 assert.match(readFileSync('public/ui/wallet-home.css','utf8'),/pointer-events:none/);
 assert.ok(statSync('public/images/mediq-wallet-leather-v1.webp').size<2097152);
 const sw=readFileSync('public/mobile/sw.js','utf8');
 assert.match(sw,/\/ui\/wallet-open.css/);assert.match(sw,/\/images\/mediq-wallet-leather-v1.webp/);
});
