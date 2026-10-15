async page => {
 const mobile=new URL(page.url()).pathname.startsWith('/mobile/');
 const root=page.locator(mobile?'.mq-mobile-records':'#patient-health-records');
 const records=page.locator(mobile?'.mobile-nav [data-tab=records]':'#patient-portal-app .nav [data-route=phr]');
 const checks=[];
 await records.click();
 await root.locator('.mq-wallet-art').evaluate(img=>img.decode());
 if(await root.locator('.mq-wallet-dock [data-wallet-route=records]').count())throw Error('SELECTED_CARD_STILL_IN_WALLET');
 if(await root.locator('.mq-wallet-dock button').count()!==3)throw Error('REMAINING_CARD_COUNT');
 checks.push('selected-card-extracted');
 for(const width of mobile?[390,360,320]:[1440,1024,768]){
  await page.setViewportSize({width,height:1000});
  const geometry=await root.evaluate(el=>{
   const sheet=el.querySelector('.health-expanded-card'),dock=el.querySelector('.mq-wallet-dock');
   const image=dock.querySelector('img');
   return {overflow:document.documentElement.scrollWidth>innerWidth,sheetBottom:sheet.getBoundingClientRect().bottom,dockTop:dock.getBoundingClientRect().top,
    source:new URL(image.currentSrc).pathname,loaded:image.complete&&image.naturalWidth>0,
    sizes:[...dock.querySelectorAll('button')].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),
    passive:getComputedStyle(dock.querySelector('.mq-wallet-pocket')).pointerEvents==='none'};
  });
  if(geometry.overflow||!geometry.loaded||!geometry.passive||geometry.dockTop<geometry.sheetBottom||geometry.source!=='/images/mediq-wallet-front-v1.webp'||geometry.sizes.some(b=>b.width<44||b.height<44))throw Error(JSON.stringify({width,geometry}));
  checks.push('geometry-'+width);
 }
 await page.setViewportSize({width:mobile?390:1440,height:1000});
 await root.locator('[data-wallet-route=sharing]').click();
 await page.locator(mobile?'#tab-share':'#patient-portal-app [data-page=sharing]').waitFor({state:'visible'});checks.push('share-card');
 await records.click();await root.locator('[data-wallet-route=helper]').focus();await page.keyboard.press('Enter');
 await page.locator(mobile?'#tab-helper':'#patient-portal-app [data-page=helper]').waitFor({state:'visible'});checks.push('helper-keyboard');
 await records.click();await root.locator('[data-wallet-route=requests]').click();
 await page.locator(mobile?'#tab-share':'#patient-portal-app [data-page=activity]').waitFor({state:'visible'});checks.push('requests-card');
 await records.click();await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/extracted-card-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true,animations:'disabled'});
 return {scope:'EXTRACTED_HEALTH_CARD_AND_HOME_WALLET',mobile,checks,status:'PASS',review:'DRAFT / UNASSIGNED'};
}
