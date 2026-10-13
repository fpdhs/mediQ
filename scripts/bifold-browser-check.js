async page => {
 const mobile=new URL(page.url()).pathname.startsWith('/mobile/');
 const root=page.locator(mobile?'.mq-mobile-records':'#patient-health-records');
 const records=page.locator(mobile?'.mobile-nav [data-tab=records]':'#patient-portal-app .nav [data-route=phr]');
 const checks=[];
 await records.click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.health-bifold-body')].some(img=>img.complete&&img.naturalWidth>0),{},{timeout:10000});
 for(const width of mobile?[390,360,320]:[1440,1024,768]){
  await page.setViewportSize({width,height:1000});
  const state=await root.locator('.health-bifold').evaluate(el=>{
   const img=el.querySelector('img'),buttons=[...el.querySelectorAll('button')];
   return {loaded:img.complete&&img.naturalWidth>0,overflow:document.documentElement.scrollWidth>innerWidth,
    sizes:buttons.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),
    passive:getComputedStyle(el.querySelector('.health-bifold-pocket')).pointerEvents==='none'};
  });
  if(!state.loaded||state.overflow||!state.passive||state.sizes.some(b=>b.width<44||b.height<44))throw Error(JSON.stringify({width,state}));
  checks.push('geometry-'+width);
 }
 await page.setViewportSize({width:mobile?390:1440,height:1000});
 await root.locator('.health-bifold-share').click();
 await page.locator(mobile?'#tab-share':'#patient-portal-app [data-page=sharing]').waitFor({state:'visible'});
 if(await root.isVisible())throw Error('SHARE_DID_NOT_NAVIGATE');checks.push('share-card');
 await records.click();
 await root.locator('.health-bifold-helper').focus();await page.keyboard.press('Enter');
 await page.locator(mobile?'#tab-helper':'#patient-portal-app [data-page=helper]').waitFor({state:'visible'});
 if(await root.isVisible())throw Error('HELPER_DID_NOT_NAVIGATE');checks.push('helper-keyboard');
 await records.click();await page.emulateMedia({reducedMotion:'reduce'});
 await root.locator('.health-bifold').scrollIntoViewIfNeeded();
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/bifold-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true,animations:'disabled'});
 return {scope:'RECORDS_WALLET_UI',mobile,checks,status:'PASS',review:'DRAFT / UNASSIGNED'};
}
