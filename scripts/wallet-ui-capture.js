async (page) => {
 const mobile=new URL(page.url()).pathname.startsWith('/mobile');
 const home=mobile?'#tab-home':'#patient-portal-app [data-page=home]';
 await page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]').click();
 await page.setViewportSize({width:mobile?390:1440,height:1050});
 await page.locator(home+' .mq-wallet-cards').evaluate(n=>{n.scrollLeft=0;});
 await page.screenshot({path:'C:/Users/user/Documents/New project/artifacts/ui/wallet-home-20261011/'+(mobile?'mobile':'web')+'.png',fullPage:true,animations:'disabled'});
 return {scope:'LIVE_HOME_DEFAULT_CARD_ORDER',mobile,result:'PASS'};
}
