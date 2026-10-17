async (page) => {
  const mobile=new URL(page.url()).pathname.startsWith('/mobile');
  const home=mobile?'#tab-home':'#patient-portal-app [data-page=home]';
  const navHome=mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]';
  const destinations=mobile?{requests:'#tab-share',records:'#tab-records',sharing:'#tab-share',helper:'#tab-helper'}:{requests:'[data-page=activity]',records:'[data-page=phr]',sharing:'[data-page=sharing]',helper:'[data-page=helper]'};
  const checks=[];
  await page.locator(home+' .mq-wallet-home').waitFor({state:'visible'});
  await page.waitForFunction(()=>{const image=document.querySelector('.mq-wallet-art');return image?.complete&&image.naturalWidth===1905;},{},{timeout:15000});
  checks.push({route:'deployed-wallet-artwork',result:'PASS'});
  if(await page.locator(home+' [data-wallet-route]').count()!==4)throw new Error('FOUR_CARDS_REQUIRED');
  for(const [route,destination] of Object.entries(destinations)){
    await page.locator(home+' [data-wallet-route='+route+']').click();
    await page.locator(destination).waitFor({state:'visible'});
    checks.push({route,result:'PASS'});
    await page.locator(navHome).click();
    await page.locator(home+' .mq-wallet-home').waitFor({state:'visible'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator(home+' [data-wallet-route=records]').click();
  await page.locator(destinations.records).waitFor({state:'visible'});
  await page.locator(navHome).click();
  checks.push({route:'reduced-motion',result:'PASS'});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const widths=mobile?[390,360,320]:[1440,1024,768];
  for(const width of widths){
    await page.setViewportSize({width,height:mobile?900:1050});
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    checks.push({route:'home-width-'+width,result:layout.scroll<=width?'PASS':'FAIL',...layout});
    if(layout.scroll>width)throw new Error('HORIZONTAL_OVERFLOW_'+width);
  }
  await page.setViewportSize({width:mobile?390:1440,height:mobile?1050:1050});
  await page.screenshot({path:'C:/Users/user/Documents/New project/artifacts/ui/wallet-home-20261011/'+(mobile?'mobile':'web')+'.png',fullPage:true,animations:'disabled'});
  return {scope:'ACTUAL_BROWSER_NAVIGATION_ONLY',mobile,checks,consentMutation:false};
}
