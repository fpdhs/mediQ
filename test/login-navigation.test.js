import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isSecurityAdminSession, loginHomePath, loginIntentFromSearch, loginReturnUrl, requiresEntra} from '../public/login-navigation.js';
test('web and mobile retain their own fixed home paths', () => {
  for (const path of ['/mobile', '/mobile/', '/mobile/index.html']) assert.equal(loginHomePath(path), '/mobile/');
  for (const path of ['/', '/hipass/', '/index.html', '/mobile-evil']) assert.equal(loginHomePath(path), '/hipass/');
});
test('return destination never carries arbitrary hosts, query or fragments', () => {
  for (const path of ['https://evil.example/', '//evil.example/', '/?next=http://127.0.0.1', '/#access_token=secret']) {
    assert.equal(loginReturnUrl('https://demo.example', path), 'https://demo.example/hipass/');
  }
});
test('single-import verification has one fixed same-origin return destination',()=>{
  assert.equal(loginReturnUrl('https://demo.example','/single-import-check.html'),'https://demo.example/single-import-check.html');
  for(const path of ['/single-import-check.html?next=evil','/single-import-check.html#token','//single-import-check.html'])
    assert.equal(loginReturnUrl('https://demo.example',path),'https://demo.example/hipass/');
});
test('security sign-in intent only round-trips through a fixed same-origin URL',()=>{
  assert.equal(loginReturnUrl('https://demo.example','/hipass/','SECURITY_ADMIN'),'https://demo.example/hipass/?loginIntent=security');
  assert.equal(loginReturnUrl('https://demo.example','/mobile/','SECURITY_ADMIN'),'https://demo.example/mobile/?loginIntent=security');
  assert.equal(loginReturnUrl('https://demo.example','/hipass/','PLATFORM_ADMIN'),'https://demo.example/hipass/');
  assert.equal(loginIntentFromSearch('?loginIntent=security'),'SECURITY_ADMIN');
  for(const search of ['?loginIntent=SECURITY_ADMIN','?loginIntent=security&next=https://evil.example','?loginIntent=security&loginIntent=security'])
    assert.equal(loginIntentFromSearch(search),null);
});
test('security sign-in requires a server-mapped security-only session',()=>{
  assert.equal(isSecurityAdminSession({roles:['SECURITY_ADMIN']}),true);
  assert.equal(isSecurityAdminSession({roles:['DOCTOR']}),false);
  assert.equal(isSecurityAdminSession({roles:['SECURITY_ADMIN','DOCTOR']}),false);
  assert.equal(isSecurityAdminSession(null),false);
});
test('public deployment cannot fall back to presenter/password authentication', () => {
  assert.equal(requiresEntra('highpass-demo.japaneast.cloudapp.azure.com'), true);
  assert.equal(requiresEntra('localhost'), false);
});
test('both HTML shells load the pre-auth guard before module execution', () => {
  for (const file of ['public/index.html','public/mobile/index.html']) {
    const html=readFileSync(file,'utf8');
    assert.ok(html.indexOf('/auth-boot.css')>html.indexOf('<head>'));
    assert.ok(html.indexOf('/auth-boot.css')<html.indexOf('<body'));
  }
  const css=readFileSync('public/auth-boot.css','utf8');
  assert.match(css,/data-capstone/);assert.match(css,/data-auth-ready/);
  assert.match(css,/:not\(#capstone-login\)/);assert.match(css,/visibility: hidden/);
});
