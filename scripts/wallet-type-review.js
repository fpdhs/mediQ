async (page) => {
 const mobile=new URL(page.url()).pathname.startsWith('/mobile');
 const checks=[];
 await page.locator('.mq-wallet-home').waitFor({state:'visible',timeout:15000});
 for(const width of (mobile?[390,360,320]:[1440,1024,768])){
  await page.setViewportSize({width,height:1050});
  for(const reducedMotion of ['reduce','no-preference']){
   await page.emulateMedia({reducedMotion});
   await page.mouse.move(0,0);
   const result=await page.evaluate(()=>({
    heading:document.querySelector('.mq-wallet-greeting h1').textContent,
    width:innerWidth,scroll:document.documentElement.scrollWidth,
    cards:[...document.querySelectorAll('.mq-wallet-card')].map(e=>({transform:getComputedStyle(e).transform,transition:getComputedStyle(e).transitionDuration})),
    recordSize:getComputedStyle(document.querySelector('.mq-wallet-row strong')).fontSize
   }));
   if(result.scroll>width||result.cards.some(c=>c.transform==='none')||!result.heading.includes('다음 진료를 준비해요.'))throw Error('WALLET_LAYOUT_REGRESSION');
   if(reducedMotion==='reduce'&&result.cards.some(c=>c.transition!=='0s'))throw Error('REDUCED_MOTION_REGRESSION');
   checks.push({width,reducedMotion,result:'PASS',...result});
  }
 }
 await page.setViewportSize({width:mobile?390:1440,height:1050});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/wallet-type-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true,animations:'disabled'});
 return {scope:'LIVE_WALLET_TYPOGRAPHY_AND_STATIC_GEOMETRY',mobile,review:'DRAFT / UNASSIGNED',checks};
}
