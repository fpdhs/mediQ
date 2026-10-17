async (page) => {
  const target=page.url();
  await page.evaluate(async()=>{if(navigator.serviceWorker)for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();});
  await page.goto('about:blank');
  await page.unrouteAll({behavior:'ignoreErrors'});
  const files=['app.js','index.html','mobile/app.js','mobile/index.html','mobile/sw.js','ui/wallet-home.js','ui/wallet-home.css','ui/patient-health.js','ui/patient-sharing.js','images/mediq-wallet-front-v1.webp'];
  files.push('ui/wallet-open.css','images/mediq-wallet-leather-v1.webp');
  files.push('ui/wallet-bifold.css','images/mediq-wallet-bifold-v1.webp');
  files.push('ui/wallet-record-sheet.css');
  await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    const file=path==='/hipass/'?'index.html':path==='/mobile/'?'mobile/index.html':path.slice(1);
    // B injects the mandatory capstone auth marker into desktop HTML.
    // Keep that real response and add only the candidate stylesheet for local review.
    if(file==='mobile/sw.js')await route.fulfill({status:404,body:'Local candidate review: service worker disabled'});
    else if(file==='index.html'||file==='mobile/index.html')await route.continue();
    else if(files.includes(file))await route.fulfill({path:'C:/Users/user/Documents/New project/public/'+file,contentType:file.endsWith('.webp')?'image/webp':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
    else await route.continue();
  });
  await page.goto(target);
  await page.addStyleTag({url:'https://192.168.111.149:9443/ui/wallet-home.css'});
  return {scope:'LOCAL_UI_OVERLAY_REAL_BACKEND',apiMocked:false};
}
