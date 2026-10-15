import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
const output='output/playwright/shared-demo-tools';await mkdir(output,{recursive:true});
const results=[];
try {
 for(const width of [1440,390,320]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/#PATIENT');
  await page.locator('.mq-wallet-home').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.mq-demo-tools').isVisible(),false);
  const panel=page.locator('#clinician-tools');
  await page.locator('#open-patient-tools').click();
  assert.equal(await panel.isVisible(),true);
  assert.equal(await page.locator('dialog').filter({has:page.locator('.demo-tools-heading')}).count(),1);
  assert.equal(await panel.locator('[data-demo-action=sharing]').isVisible(),true);
  assert.equal(await panel.locator('[data-demo-action=audit]').count(),0);
  assert.equal(await panel.locator('[data-group=flow] h3').textContent(),'시연 진행');
  assert.equal(await panel.locator('[data-demo-action=patient-home]').getAttribute('aria-current'),'page');
  assert.equal(await panel.locator('[data-demo-action=sharing] svg').count(),1);
  assert.equal(await panel.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  assert.equal(await panel.locator('.demo-tools-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('demo-tools-close')),true);
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#clinician-tools').contains(document.activeElement)),true);}
  await page.screenshot({path:`${output}/patient-${width}.png`});
  await page.keyboard.press('Escape');
  assert.equal(await panel.isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'open-patient-tools');
  await page.locator('#open-patient-tools').click();
  await panel.locator('[data-demo-action=doctor-home]').click();
  assert.equal(await page.locator('#hospital-saas-app').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#open-clinician-tools').click();
  assert.equal(await panel.locator('[data-demo-action=pacs]').isVisible(),true);
  assert.equal(await panel.locator('[data-demo-action=sharing]').count(),0);
  assert.equal(await panel.locator('[data-demo-action=admin]').count(),0);
  assert.equal(await panel.locator('[data-group=explanation] h3').textContent(),'보안 설명');
  assert.equal(await panel.locator('[data-group=execution] [data-demo-action=simulate]').count(),1);
  assert.equal(await panel.locator('[data-demo-action=doctor-home]').getAttribute('aria-current'),'page');
  assert.equal(await panel.locator('.demo-tools-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);
  const copyWidth=await panel.locator('[data-demo-action=simulate] .demo-menu-copy').evaluate(e=>e.getBoundingClientRect().width);
  assert.ok(copyWidth>=130,`menu label width ${copyWidth} at viewport ${width}`);
  assert.equal(await panel.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await page.screenshot({path:`${output}/doctor-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'open-clinician-tools');
  assert.deepEqual(errors,[]);results.push({width,result:'PASS',checks:['one shared dialog','role menus','focus containment','Escape and focus return','no overflow','no page errors']});
  await page.close();
 }
 const fixture=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await fixture.route('**/__demo_menu_fixture__',route=>route.fulfill({contentType:'text/html',body:'<html lang="ko"><head><link rel="stylesheet" href="/ui/clinician-demo-tools.css"></head><body><button data-demo-tools-open>열기</button><dialog id="clinician-tools" aria-labelledby="clinician-tools-title"></dialog></body></html>'}));
 await fixture.goto('http://localhost:3000/__demo_menu_fixture__');
 await fixture.evaluate(async()=>{
   const {initializeDemoTools}=await import('/ui/demo-tools.js');
   window.fixtureExecutions=0;
   initializeDemoTools({read:()=>({persona:'DOCTOR',roles:['DOCTOR'],environment:'PUBLIC',ready:true,
     study:{patientId:'SYNTHETIC-P1',studyInstanceUid:'2.25.1',description:'합성 MRI',sourceHospitalId:'HOSP-A'},
     consent:{patientId:'SYNTHETIC-P1',status:'ACTIVE',permission:'VIEW_ONLY',validFrom:'2020-01-01',validUntil:'2099-01-01',targetHospitalId:'HOSP-B',scopes:[{studyInstanceUid:'2.25.1'}]}}),execute:()=>window.fixtureExecutions++,refresh:async()=>{}});
 });
 await fixture.locator('[data-demo-tools-open]').click();
 const restricted=fixture.locator('[data-group=restricted]');
 assert.equal(await restricted.getAttribute('open'),null);
 await restricted.locator('summary').click();
 assert.equal(await restricted.locator('button:disabled').count(),4);
 assert.equal(await fixture.locator('[data-demo-action=admin]').count(),0);
 assert.equal(await fixture.locator('.demo-tools-consent').textContent(),'공유 동의 유효');
 assert.equal(await fixture.locator('.demo-tools-permission').textContent(),'열람만');
 assert.match(await fixture.locator('.demo-tools-boundary').textContent(),/별도 확인/);
 assert.equal(await fixture.evaluate(()=>window.fixtureExecutions),0);
 assert.equal(await fixture.locator('#clinician-tools').evaluate(e=>e.scrollWidth>e.clientWidth),false);
 await fixture.screenshot({path:`${output}/public-menu-synthetic-fixture.png`});
 results.push({result:'PASS',scope:'isolated synthetic UI fixture, not Azure authentication',checks:['public restrictions collapsed','all restricted actions disabled','no admin menu','consent not represented as access or receipt','no action executed']});
 await fixture.close();
 await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
