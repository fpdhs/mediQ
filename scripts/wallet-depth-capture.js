async (page) => {
  const mobile=new URL(page.url()).pathname.startsWith('/mobile');
  await page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]').click();
  await page.setViewportSize({width:mobile?390:1440,height:950});
  await page.locator('.mq-wallet-cards').evaluate(n=>{n.scrollLeft=0;});
  await page.evaluate(()=>window.scrollTo(0,0));
  const layout=await page.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,width:r.width}:null;};
    return {header:rect('.mobile-header'),greeting:rect('.mq-wallet-greeting'),wallet:rect('.mq-wallet-object'),width:innerWidth,scroll:document.documentElement.scrollWidth};
  });
  await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/wallet-depth-'+(mobile?'mobile':'web')+'.png',fullPage:true,animations:'disabled'});
  const shell=mobile?await page.evaluate(async()=>({caches:await caches.keys(),image:document.querySelector('.mq-wallet-art')?.naturalWidth})):null;
  return {scope:'WALLET_DEPTH_VISUAL',mobile,layout,shell};
}
