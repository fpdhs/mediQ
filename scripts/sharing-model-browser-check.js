async (page) => {
  const results=[];
  const check=(name,ok)=>{results.push({name,result:ok?'PASS':'FAIL'});if(!ok)throw new Error(name);};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const mobile of [false,true]){
    await page.goto('http://127.0.0.1:11447/preview'+(mobile?'?mobile=1':''));
    for(const width of mobile?[390,360,320]:[1440,1024,768,390,320]){
      await page.setViewportSize({width,height:1050});
      check(`${mobile?'mobile':'web'} ${width}px no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const host=mobile?'#share-wizard-wrap':'.sharing-open-wallet';
      check(`${mobile?'mobile':'web'} ${width}px actual model layers`,await page.locator(host).evaluate(el=>['::before','::after'].every(p=>{const s=getComputedStyle(el,p);return s.display!=='none'&&s.backgroundImage.includes('mediq-wallet-model-')&&s.pointerEvents==='none';})));
    }
    await page.setViewportSize({width:mobile?390:1440,height:1100});
    if(mobile){
      await page.getByRole('button',{name:'받는 병원 선택하기',exact:true}).click();
      check('mobile next step',await page.locator('.step-dot[aria-current="step"]').textContent().then(t=>t.includes('병원')));
      await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/sharing-model-mobile-settings.png',fullPage:true});
      await page.locator('#btn-wizard-back-to-1').click();
      check('mobile back preserves step',await page.locator('.step-dot[aria-current="step"]').textContent().then(t=>t.includes('검사')));
    }else{
      check('unselected hospital blocks review',await page.getByRole('button',{name:'공유 내용 확인하기',exact:true}).isDisabled());
      await page.getByRole('combobox',{name:'새 공유 수신 병원 선택',exact:true}).selectOption('HOSP-B');
      check('selected destination updates summary',await page.locator('#sharing-summary-title').textContent().then(t=>t.includes('B대학병원')));
      check('valid draft enables review',await page.locator('#sharing-prepare').isEnabled());
      const end=await page.locator('#sharing-until').inputValue();
      await page.locator('#sharing-until').fill('2020-01-01T00:00');
      check('expired draft blocks review',await page.locator('#sharing-prepare').isDisabled());
      await page.locator('#sharing-until').fill(end);
      await page.locator('#sharing-prepare').click();
      check('fixture only requests review, does not approve',await page.locator('.preview-label').textContent().then(t=>t.includes('동의를 생성하지 않습니다')));
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    check('reduced motion keeps static depth',await page.locator(mobile?'#share-wizard-wrap':'.sharing-open-wallet').evaluate(el=>/mediq-wallet-model-(mobile-)?front/.test(getComputedStyle(el,'::after').backgroundImage)));
    await page.screenshot({path:`C:/Users/user/Documents/New project/output/playwright/sharing-model-${mobile?'mobile':'web'}-final.png`,fullPage:true});
  }
  check('no uncaught browser errors',errors.length===0);
  return {scope:'LOCAL_SYNTHETIC_FIXTURE_NOT_SERVER_E2E',review:'DRAFT / UNASSIGNED',results};
}
