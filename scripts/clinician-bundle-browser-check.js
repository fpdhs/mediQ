async(page)=>{
  const app=page.locator('#hospital-saas-app');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const routes=['dashboard','records','viewer','qr','transfer'];
  for(const route of routes){
    await app.locator(`.mq-nav-group:not([hidden]) [data-view="${route}"]`).click();
    const shown=await app.locator('.mq-screen').evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>n.dataset.screen));
    if(shown.length!==1||shown[0]!==route)throw Error('MENU_NOT_EXCLUSIVE_'+route);
    if(route==='viewer')await app.locator('.mq-viewer-back').click();
  }
  await page.locator('#open-clinician-tools').click();
  for(const route of ['pacs','journey','doctor-home']){
    const target=page.locator(`#clinician-tools [data-demo-action="${route}"]`);
    if(await target.count()!==1)throw Error('TOOL_MISSING_'+route);
  }
  if(await page.locator('#clinician-tools [data-demo-action="sharing"]').count())throw Error('PATIENT_MENU_IN_DOCTOR_PANEL');
  await page.locator('.demo-tools-close').click();
  await app.locator('[data-view="dashboard"]').click();
  const widths=[];
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('HOME_OVERFLOW_'+width);
    widths.push(width);
  }
  await page.setViewportSize({width:1440,height:1000});
  if(errors.length)throw Error('PAGE_ERRORS');
  return {status:'PASS',scope:'LOCAL_SOURCE_MENU_NAVIGATION_ONLY_NOT_B_CANDIDATE_LOGIN',routes,widths,pageErrors:errors};
}
