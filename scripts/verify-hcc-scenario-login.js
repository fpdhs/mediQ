// Actual Chrome + real capstone mock IdP, isolated login component only.
// No fake PACS/Key Vault/clinical API; not deployed-home/Viewer evidence.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createServer as reservePort} from 'node:net';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {createCapstoneMockIdp} from '../src/capstone-mock-idp.js';
import {createCapstoneBPortal} from '../src/capstone-b-portal.js';
import {connectPatientBrowserCdp,patientBrowserHasTerminated} from './lib/patient-browser-integration.js';
const secret=()=>randomBytes(32).toString('hex'),loginKey=secret(),checks=[],start=Date.now();
const root=path.resolve('public'),output=path.resolve('artifacts/workstation/hcc-main-login'),profile=path.resolve('tmp','hcc-login-'+randomBytes(6).toString('hex'));
const login=createCapstoneMockIdp({NODE_ENV:'production',AUTH_MODE:'TEST',HIPASS_CONTROL_PLANE_ONLY:'1',HIPASS_CAPSTONE_MOCK_IDP:'1',HIPASS_CAPSTONE_MAIN_SCENARIO:'HCC',HIPASS_CAPSTONE_LOGIN_KEY:loginKey,TEST_JWT_SECRET:secret(),JWT_ISSUER:'highpass-capstone-test-idp',JWT_AUDIENCE:'highpass-capstone-api'});
const staticPortal=createCapstoneBPortal({root,ca:await readFile('tmp/certs/mtls/ca.crt')});
const server=createServer({cert:await readFile('tmp/certs/edge/localhost.crt'),key:await readFile('tmp/certs/edge/localhost.key')},async(req,res)=>{
  res.setHeader('cache-control','no-store');
  try{
    if(req.url==='/hipass/'||req.url==='/mobile/'){
      res.setHeader('content-type','text/html; charset=utf-8');
      res.end('<!doctype html><html lang="ko" data-capstone="1"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="entry-result"></div><script type="module" src="/entry-probe.js"></script></html>');return;
    }
    if(req.url==='/entry-probe.js'){
      res.setHeader('content-type','application/javascript');res.end("import{initializeCapstoneAuth}from'/capstone-auth.js';const auth=await initializeCapstoneAuth();const e=document.querySelector('#entry-result');e.textContent=auth.context.patientName+' · '+auth.context.scenario.age+'세 · '+auth.context.entryRole;e.dataset.patientId=auth.context.patientId;e.dataset.role=auth.context.entryRole;");return;
    }
    if(req.url==='/api/capstone-demo/scenario'){res.setHeader('content-type','application/json');res.end(JSON.stringify({mainScenario:true,patientProfile:'HCC_SYNTHETIC',catalogRegistered:true,synthetic:true}));return;}
    if(req.url==='/api/capstone-demo/login'&&req.method==='POST'){
      let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)throw new Error('BODY_LIMIT');body+=chunk;}
      const result=login({...JSON.parse(body),ip:req.socket.remoteAddress,hccRegistered:true});
      res.writeHead(result.status,{'content-type':'application/json'});res.end(JSON.stringify(result.body));return;
    }
    if(req.url.startsWith('/api/')||req.url.startsWith('/patient-dicomweb/')){res.writeHead(503);res.end();return;}
    await staticPortal(req,res);
  }catch{res.writeHead(500);res.end();}
});server.requestTimeout=15000;server.headersTimeout=10000;
let browser,cdp,profileCreated=false,status='FAIL',cleanup=false,errorCode;
const until=async predicate=>{const end=Date.now()+15000;while(Date.now()<end){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('LOGIN_BROWSER_TIMEOUT');};
try{
  await mkdir(output,{recursive:true});await mkdir(profile);profileCreated=true;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='https://127.0.0.1:'+server.address().port;
  const reservation=reservePort();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-proxy-server','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','about:blank'],{windowsHide:true,stdio:'ignore'});
  await until(async()=>{try{return(await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}});
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about%3Ablank',{method:'PUT',signal:AbortSignal.timeout(3000)})).json();cdp=await connectPatientBrowserCdp(tab.webSocketDebuggerUrl);
  const evaluate=async expression=>{const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.equal(result.exceptionDetails,undefined);return result.result.value;};
  const click=async selector=>{const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView();const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});};
  await cdp.send('Page.enable');await cdp.send('Runtime.enable');
  for(const mode of ['PATIENT','DOCTOR','MOBILE']){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:mode==='MOBILE'?390:1280,height:900,deviceScaleFactor:1,mobile:mode==='MOBILE'});
    const navigation=await cdp.send('Page.navigate',{url:origin+(mode==='MOBILE'?'/mobile/':'/hipass/')});assert.equal(navigation.errorText,undefined);
    await until(()=>evaluate("!!document.querySelector('#capstone-login-key')&&!document.querySelector('[type=submit]').disabled"));
    assert.equal(await evaluate("document.querySelector('#capstone-patient-profile').options.length"),1);
    assert.equal(await evaluate("document.querySelector('#capstone-patient-profile').value"),'HCC_SYNTHETIC');
    if(mode==='DOCTOR')await click('[data-entry-role="DOCTOR"]');
    if(mode==='MOBILE')assert.equal(await evaluate("document.querySelector('.mediq-login-roles').hidden"),true);
    await evaluate('document.fonts.ready.then(()=>true)');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No horizontal overflow');
    await writeFile(path.join(output,mode.toLowerCase()+'-login.png'),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    if(mode==='PATIENT'){
      await click('#capstone-login-key');await cdp.send('Input.insertText',{text:'invalid-key'});await click('[type=submit]');
      await until(()=>evaluate("!!document.querySelector('#capstone-login-error').textContent&&!document.querySelector('[type=submit]').disabled"));
      assert.equal(await evaluate("document.querySelector('#capstone-login-key').value"),'');checks.push('INVALID_KEY_DENIED_FORM_RETAINED_KEY_CLEARED');
    }
    await click('#capstone-login-key');await cdp.send('Input.insertText',{text:loginKey});await click('[type=submit]');
    await until(()=>evaluate("!document.querySelector('#capstone-login')&&!!document.querySelector('#entry-result').dataset.role"));
    assert.equal(await evaluate("document.querySelector('#entry-result').dataset.patientId"),'MEDIQ-SYN-HCC-001');
    assert.equal(await evaluate("document.querySelector('#entry-result').dataset.role"),mode==='DOCTOR'?'DOCTOR':'PATIENT');
    assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);
    assert.equal(await evaluate("document.querySelector('#entry-result').inert"),false);
    assert.ok(!(await evaluate('location.href')).includes(loginKey));
    checks.push(mode+'_REAL_SIGNED_LOGIN_FIXED_PATIENT_ROLE_NO_STORAGE_OR_URL_TOKEN');
  }
  assert.equal(login({key:loginKey,ip:'192.0.2.1',patientProfile:'PHANTOM',hccRegistered:true}).status,409);
  checks.push('LEGACY_PROFILE_SERVER_DENIED');status='PASS';
}catch(error){errorCode=/^[A-Z_]+$/.test(error.message)?error.message:'ASSERTION_OR_TRANSPORT_FAILURE';}
finally{
  cdp?.close();
  try{
    if(browser&&!patientBrowserHasTerminated(browser))execFileSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',timeout:10000});
    server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));
    if(profileCreated){assert.equal(path.dirname(profile),path.resolve('tmp'));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
    cleanup=true;
  }catch{status='FAIL';errorCode='OWNED_BROWSER_CLEANUP_FAILED';}
  const result={status,review:'DRAFT / UNASSIGNED',scope:'ISOLATED_ACTUAL_CHROME_LOGIN_COMPONENT_REAL_MOCK_IDP_ONLY_NOT_FULL_HOME_PACS_VAULT_DEPLOYMENT',checks,errorCode,cleanup,elapsedMs:Date.now()-start};
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=status==='PASS'?0:1;
}
