async(page)=>{
  const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  const check=(name,ok)=>{results.push({name,result:ok?'PASS':'FAIL'});if(!ok)throw Error(name);};
  await page.goto('http://127.0.0.1:11448/preview');
  await page.getByRole('heading',{name:'환자가 공유한 건강기록',exact:true}).waitFor();
  check('no health records preselected',await page.locator('#share-health-picker input:checked').count()===0);
  await page.locator('#share-health-picker input').first().check();check('explicit selection summary',await page.locator('#picker-result').textContent().then(t=>t.includes('2026 건강검진')));
  check('shared 2025/2026 checkup comparison',await page.locator('.chr-detail table').textContent().then(t=>t.includes('2025-10-08')&&t.includes('74 kg')&&t.includes('72 kg')));
  await page.setViewportSize({width:320,height:1050});check('320px checkup table scrolls within its panel',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'혈액검사',exact:true}).click();
  await page.locator('.chr-record').first().click();
  check('actual fixed AFP value',await page.locator('.chr-value').textContent().then(t=>t.includes('24.6')));
  check('only shared previous result comparison',await page.locator('.chr-comparison').textContent().then(t=>t.includes('8.4')&&t.includes('192.9%')));
  await page.getByRole('button',{name:'공유 범위 확인',exact:true}).click();check('scope disclosure',await page.locator('.chr-scope').isVisible());
  for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1050});check(`${width}px no document overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===1440||width===390)await page.screenshot({path:`C:/Users/user/Documents/New project/output/playwright/clinician-health-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'초음파',exact:true}).click();await page.locator('.chr-record').first().click();
  check('synthetic ultrasound asset loaded',await page.locator('.chr-detail img').evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.getByRole('searchbox',{name:'공유 기록 검색'}).fill('없는검사');check('search empty state',await page.locator('.chr-record').count()===0);
  check('no browser JS errors',errors.length===0);
  return {scope:'LOOPBACK_TEST_JWT_MEMORY_FIXTURE_NOT_DEPLOYED_E2E',review:'DRAFT / UNASSIGNED',results};
}
