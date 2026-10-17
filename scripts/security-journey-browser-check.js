async(page)=>{
  const root='C:/Users/user/Documents/New project/output/playwright/';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const home=page.locator('[data-journey-overview]');
  await home.waitFor({state:'visible'});
  if(await home.locator('button[data-journey-gate]').count()!==8)throw Error('GATE_COUNT');
  const results=[];
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    await page.locator('[data-journey-gallery] img').evaluateAll(async images=>Promise.all(images.map(img=>img.decode())));
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('OVERVIEW_OVERFLOW_'+width);
    if(width===1440||width===390)await page.screenshot({path:root+`security-gates-home-${width}.png`,fullPage:true});
    results.push({width,overview:'PASS'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await home.locator('[data-journey-gate="0"]').click();
  const image=page.locator('[data-journey-image]');
  const srcs=[];
  for(let i=0;i<8;i++){
    await page.locator(`.journey-steps [data-journey-gate="${i}"]`).click();
    await image.evaluate(img=>img.decode());
    srcs.push(await image.getAttribute('src'));
    if(!await image.getAttribute('alt'))throw Error('ALT_MISSING');
    if(!await page.locator('[data-journey-status]').textContent().then(t=>t.includes(`${i+1}/8`)))throw Error('STATUS_MISMATCH');
    if(i===5)await page.screenshot({path:root+'security-gates-detail-1440.png',fullPage:true});
  }
  if(new Set(srcs).size!==8)throw Error('IMAGE_NOT_DISTINCT');
  if(!await page.locator('[data-journey-next]').isDisabled())throw Error('LAST_NEXT_ENABLED');
  await page.locator('.journey-scenarios summary').click();
  await page.locator('[data-journey-scenario="denied"]').click();
  if(!await page.locator('[data-journey-next]').isDisabled())throw Error('DENIAL_NEXT_ENABLED');
  await page.locator('[data-journey-scenario="unavailable"]').click();
  if(!await page.locator('[data-journey-title]').textContent().then(t=>t.includes('거부가 아니')))throw Error('ERROR_DENIAL_CONFUSED');
  await page.locator('.journey-steps [data-journey-gate="5"]').click();
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('DETAIL_OVERFLOW_'+width);
    if(width===390)await page.screenshot({path:root+'security-gates-detail-390.png',fullPage:true});
  }
  await page.route('**/assets/security-journey/identity-v1.webp',route=>route.fulfill({status:404,body:''}));
  await page.locator('.journey-steps [data-journey-gate="0"]').click();
  await page.locator('[data-journey-image-error]').waitFor({state:'visible'});
  if(!await page.locator('[data-journey-description]').textContent())throw Error('FALLBACK_DESCRIPTION_MISSING');
  await page.unroute('**/assets/security-journey/identity-v1.webp');
  await page.locator('.journey-steps [data-journey-gate="1"]').click();
  await image.evaluate(img=>img.decode());
  await page.locator('[data-journey-home]').click();
  await home.waitFor({state:'visible'});
  await page.setViewportSize({width:1440,height:1000});
  if(errors.length)throw Error('PAGE_ERRORS: '+errors.join(','));
  return {scope:'EXPLANATION_UI_ONLY',results,distinctImages:new Set(srcs).size,imageFailureFallback:'PASS',denialAndUnavailable:'PASS',pageErrors:errors};
}
