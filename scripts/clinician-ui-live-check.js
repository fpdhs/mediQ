// Real synthetic browser regression. Secrets stay in memory; no traces/header dumps.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>v.startsWith('--')?[...a,[v.slice(2),all[i+1]]]:a,[]));
if(!args.playwright||!args.folder||!args.image||!args.revision)throw Error('BROWSER_ARGUMENTS_REQUIRED');
const folder=resolve(args.folder),root=process.cwd();
if(!relative(resolve('artifacts/workstation'),folder)||relative(resolve('artifacts/workstation'),folder).startsWith('..'))throw Error('EVIDENCE_FOLDER_INVALID');
const {chromium}=await import(pathToFileURL(args.playwright));
const report={status:'FAIL',scope:'SYNTHETIC_UI_LOGIN_NAVIGATION_API_ERROR_HANDLING_AND_SHARE_FORM_ONLY',image:args.image,sourceRevision:args.revision,checks:{},apiResponses:[],limitations:['No new consent or transfer is created.','New health-record/PACS backend completion is not inferred from a visible menu.'],observedAt:new Date().toISOString()};
const browser=await chromium.launch({channel:'chrome',headless:false});
let secret='',auth='';
const program="import importlib.util,pathlib; p=pathlib.Path('scripts/capstone-a-gateway-ops.py'); s=importlib.util.spec_from_file_location('g',p);g=importlib.util.module_from_spec(s);s.loader.exec_module(g); import paramiko,os; c=paramiko.SSHClient();i=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud';c.load_host_keys(str(i/'known_hosts'));c.set_missing_host_key_policy(paramiko.RejectPolicy());c.connect('138.91.2.60',username='highpassadmin',key_filename=str(i/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10); f=g.root_sftp(c); key=f.open('/opt/highpass/capstone-control-secrets/capstone-login-key','rb'); import sys;sys.stdout.buffer.write(key.read(129));key.close();f.close();c.close()";
try{
  secret=execFileSync('python',['-c',program],{cwd:root,timeout:30000,stdio:['ignore','pipe','ignore']}).toString().trim();
  if(!secret||secret.length>128)throw Error('PRESENTER_CREDENTIAL_UNAVAILABLE');
  const context=await browser.newContext();
  const page=await context.newPage();const errors=[];
  page.on('pageerror',()=>errors.push('PAGE_SCRIPT_ERROR'));
  async function login(role){
    await page.goto('https://192.168.111.149:9443/hipass/#'+role,{timeout:30000});
    const entry=page.getByRole('button',{name:role==='DOCTOR'?'의료진으로 시작하기':'환자로 시작하기',exact:true});
    if(await entry.count()&&await entry.isVisible())await entry.click();
    await page.locator('#capstone-login').waitFor({state:'visible',timeout:15000});
    const mode=page.locator('#mediq-presenter-mode');if(await mode.count())await mode.check();
    await page.locator('#capstone-login-key').fill(secret);
    const loginResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/capstone-demo/login'&&response.request().method()==='POST');
    await page.locator('#capstone-login [type="submit"]').click();
    const issued=await (await loginResponse).json();
    if(role==='DOCTOR'&&issued.profiles?.DOCTOR)auth='Bearer '+issued.profiles.DOCTOR;
    await page.locator('#capstone-login').waitFor({state:'hidden',timeout:20000});
  }
  async function openPatientShare(patient){
    await patient.locator('#patient-portal-app [data-route="sharing"]:visible').first().click();
    await patient.locator('#patient-portal-app [data-page="sharing"]').waitFor({state:'visible',timeout:10000});
    for(const id of ['sharing-study','sharing-target','sharing-purpose','sharing-permission','sharing-from','sharing-until','sharing-prepare']){
      if(!await patient.locator('#'+id).count())throw Error('PATIENT_SHARE_FORM_MISSING_'+id);
    }
  }
  if(args['patient-probe-only']){
    report.scope='READ_ONLY_PATIENT_SHARE_FORM_DIAGNOSTIC';
    await login('PATIENT');await page.locator('#patient-portal-app').waitFor({state:'visible'});
    report.visibleControls=await page.locator('#patient-portal-app button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>({id:n.id,route:n.dataset.route,text:n.textContent.trim().slice(0,80)})));
    report.visiblePages=await page.locator('#patient-portal-app [data-page]').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.dataset.page));
    report.checks.patient_login='PASS';await openPatientShare(page);report.checks.patient_sharing='PASS';
    throw Error('DIAGNOSTIC_COMPLETE_NO_RELEASE_AUTHORIZATION');
  }
  await login('DOCTOR');
  await page.locator('#hospital-saas-app').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#cq-requests .cq-request') && !document.querySelector('#cq-summary')?.textContent?.includes('확인하고 있습니다'),{},{timeout:20000});
  report.checks.clinician_login='PASS';
  if(!args['api-probe-only']) {
    const pixelRequests=[];
    const observe=request=>{if(/\/dicomweb\/.*(?:rendered|frames|download)/.test(new URL(request.url()).pathname))pixelRequests.push('PIXEL_REQUEST');};
    page.on('request',observe);
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#cq-requests .cq-request').first().click();
    await page.locator('#cq-dossier h3').waitFor();
    if(!await page.locator('#cq-dossier').textContent().then(value=>value.includes('홍길동')))throw Error('MAIN_SCENARIO_NOT_CONNECTED');
    await page.locator('#cq-search').fill('없는검사검증');
    if(await page.locator('#cq-requests .cq-request').count())throw Error('HOME_SEARCH_FAILED');
    await page.locator('#cq-search').fill('');
    await page.locator('[data-cq-filter="attention"]').click();
    await page.locator('[data-cq-filter="all"]').click();
    await page.screenshot({path:resolve(folder,'clinician-home-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('HOME_MOBILE_OVERFLOW');
    await page.screenshot({path:resolve(folder,'clinician-home-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    page.off('request',observe);
    if(pixelRequests.length)throw Error('HOME_AUTOMATIC_PIXEL_DOWNLOAD');
    report.checks.clinician_home='PASS';
    report.checks.home_no_pixel_prefetch='PASS';
    if(args['viewer-check']) {
      report.scope='REAL_HONG_SCENARIO_HOME_TO_AUTHORIZED_PIXEL_VIEWER';
      if(await page.locator('#cq-open-viewer').isDisabled())throw Error('SCENARIO_CONSENT_NOT_READY');
      const issuedResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/dicom-access/request' && response.request().method()==='POST',{timeout:45000});
      await page.locator('#cq-open-viewer').click();
      const issued=await (await issuedResponse).json();
      report.viewerDecision=issued.decision;
      report.viewerReasonCode=issued.reasonCode || issued.error || null;
      if(issued.decision!=='ALLOWED'||!issued.accessToken)throw Error('VIEWER_POLICY_DENIED');
      report.checks.home_policy_token='PASS';
      await page.waitForFunction(()=>{const img=document.querySelector('#viewer-image');return img&&!img.hidden&&img.complete&&img.naturalWidth>0&&img.src.startsWith('blob:');},{},{timeout:90000});
      report.checks.hong_viewer_pixels='PASS';
      report.viewerImage=await page.locator('#viewer-image').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
      await page.screenshot({path:resolve(folder,'hong-viewer.png'),fullPage:true});
      await page.locator('.mq-viewer-back').click();
      await page.locator('[data-view="dashboard"]').click();
    }
  }
  if(args['api-probe-only']){
    report.scope='READ_ONLY_DOCTOR_API_DIAGNOSTIC';
    for(const path of ['/api/hospitals/HOSP-B/pacs-archive','/api/hospitals/HOSP-A/gateway','/api/imaging-studies','/api/v1/clinician/health-records']){
      const response=await context.request.get('https://192.168.111.149:9443'+path,{headers:{authorization:auth},timeout:10000});
      let body;try{body=await response.json();}catch{}
      report.apiResponses.push({path,status:response.status(),error:typeof body?.error==='string'?body.error:undefined});
    }
    throw Error('DIAGNOSTIC_COMPLETE_NO_RELEASE_AUTHORIZATION');
  }
  const routes=['dashboard','records','viewer','qr','transfer'];
  for(const route of routes){
    await page.locator(`#hospital-saas-app .mq-nav-group:not([hidden]) [data-view="${route}"]`).click();
    const visible=await page.locator('#hospital-saas-app .mq-screen').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>n.dataset.screen));
    if(visible.length!==1||visible[0]!==route)throw Error('MENU_NOT_EXCLUSIVE_'+route);
    if(route==='records')await page.waitForFunction(()=>!document.querySelector('#clinician-health-records')?.textContent?.includes('확인하고 있어요'),{},{timeout:15000});
    if(route==='viewer')await page.locator('.mq-viewer-back').click();
  }
  if(!auth)throw Error('AUTHENTICATED_REQUEST_NOT_OBSERVED');
  for(const path of ['/api/health','/api/security/proof-policy','/api/hospitals/HOSP-B/pacs-archive','/api/v1/clinician/health-records']){
    const response=await context.request.get('https://192.168.111.149:9443'+path,{headers:{authorization:auth},timeout:10000});
    let body;try{body=await response.json();}catch{}
    report.apiResponses.push({path,status:response.status(),result:response.ok()?'PASS':'NOT VERIFIED',error:typeof body?.error==='string'?body.error:undefined});
    if(['/api/health','/api/security/proof-policy'].includes(path)&&!response.ok())throw Error('EXISTING_CLINICIAN_API_FAILED');
    if(path==='/api/hospitals/HOSP-B/pacs-archive'&&!response.ok()){
      if(response.status()!==403||body?.error!=='METADATA_ROUTE_REQUIRED')throw Error('UNEXPECTED_ARCHIVE_FAILURE');
      await page.waitForFunction(()=>document.querySelector('#hospital-vault-list [data-vault-status]')?.textContent?.includes('확인하지 못했습니다'),{},{timeout:15000});
      if(await page.locator('#hospital-vault-list [data-vault-items] li').count())throw Error('STALE_VAULT_DATA');
      report.limitations.push('PACS archive route blocked by existing metadata-only ingress; unavailable-state display verified, PACS capability NOT VERIFIED.');
    }
  }
  // New feature errors must be visible and leave no stale protected data.
  const health=report.apiResponses.find(x=>x.path==='/api/v1/clinician/health-records');
  if(health.status!==200){
    await page.locator('[data-view="records"]').click();
    await page.locator('#clinician-health-records .chr-status').waitFor();
    if(await page.locator('#clinician-health-records .chr-record').count())throw Error('STALE_HEALTH_DATA');
    report.limitations.push('Shared health-record API not available: '+health.status+'; error-state display verified only.');
  }
  report.checks.clinician_menu_apis='PASS';
  const unauth=await browser.newContext();
  const doctorDenied=await context.request.get('https://192.168.111.149:9443/api/imaging-studies',{headers:{authorization:auth},timeout:10000});
  if(doctorDenied.status()!==403)throw Error('PATIENT_ONLY_API_ROLE_BOUNDARY_CHANGED');
  report.apiResponses.push({path:'/api/imaging-studies',status:doctorDenied.status(),result:'PASS',scope:'EXPECTED_DOCTOR_ROLE_DENIAL_OF_PATIENT_ONLY_API'});
  for(const headers of [{},{authorization:'Bearer clinician-ui-invalid-token'}]){
    const denied=await unauth.request.get('https://192.168.111.149:9443/api/imaging-studies',{headers,timeout:10000});
    if(![401,403].includes(denied.status()))throw Error('UNAUTHENTICATED_ACCESS_NOT_DENIED');
  }
  await unauth.close();report.checks.policy_denials='PASS';
  await page.locator('[data-view="dashboard"]').click();
  const widths=[];
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('HOME_OVERFLOW_'+width);
    widths.push(width);
  }
  await page.setViewportSize({width:1440,height:1000});
  await mkdir('output/playwright',{recursive:true});
  await page.screenshot({path:'output/playwright/clinician-unified-b-home.png',fullPage:true});
  // Use a separate authenticated context for patient UI. No shared clinician token.
  const patientContext=await browser.newContext();
  const patient=await patientContext.newPage();patient.on('pageerror',()=>errors.push('PATIENT_SCRIPT_ERROR'));
  await patient.goto('https://192.168.111.149:9443/hipass/#PATIENT',{timeout:30000});
  const patientEntry=patient.getByRole('button',{name:'환자로 시작하기',exact:true});
  if(await patientEntry.count()&&await patientEntry.isVisible())await patientEntry.click();
  await patient.locator('#capstone-login').waitFor({state:'visible'});
  await patient.locator('#mediq-presenter-mode').check();
  await patient.locator('#capstone-login-key').fill(secret);
  await patient.locator('#capstone-login [type="submit"]').click();
  await patient.locator('#capstone-login').waitFor({state:'hidden',timeout:20000});
  await patient.locator('#patient-portal-app').waitFor({state:'visible'});
  report.checks.patient_login='PASS';
  await openPatientShare(patient);
  report.checks.patient_sharing='PASS';
  if(errors.length)throw Error('BROWSER_SCRIPT_ERRORS');
  report.widths=widths;report.pageErrors=errors;report.status='PASS';
  await patientContext.close();await context.close();
}catch(error){report.reason=String(error.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,180);}
finally{
  secret='';auth='';await browser.close();
  await writeFile(resolve(folder,args['viewer-check']?'hong-viewer-regression.json':args['api-probe-only']?'doctor-api-diagnostic.json':args['patient-probe-only']?'patient-form-diagnostic.json':'browser-regression.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,checks:report.checks,reason:report.reason,limitations:report.limitations}));
}
if(report.status!=='PASS')process.exitCode=2;
