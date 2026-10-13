async (page) => {
 const mobile=new URL(page.url()).pathname.startsWith('/mobile/');
 await page.setViewportSize({width:mobile?390:1440,height:1000});
 const root=page.locator(mobile?'.mq-mobile-records':'#patient-health-records');
 const home=page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]');
 const checks=[];
 await home.click();
 await page.locator('[data-wallet-route=records]:visible').click();
 await root.getByRole('heading',{name:'홍길동님의 건강기록',exact:true}).waitFor({state:'visible'});
 checks.push('wallet-to-record-sheet');
 await root.getByRole('button',{name:/전체 기록 보기/}).click();
 await root.getByRole('heading',{name:'2025년',exact:true}).waitFor({state:'visible'});
 for(const [label,count] of [['혈액검사',3],['초음파',3],['의료영상',1],['건강검진',2]]){
  await root.getByRole('button',{name:label,exact:true}).click();
  if(await root.locator('.health-record').count()!==count)throw Error('FILTER_COUNT_'+label);
  checks.push('filter-'+label);
 }
 await root.getByRole('button',{name:'혈액검사',exact:true}).click();
 await root.locator('.health-record').first().click();
 await root.locator('.health-detail').getByRole('heading',{name:'혈청 AFP',exact:true}).waitFor({state:'visible'});
 if(!(await root.locator('.health-detail').innerText()).includes('24.6'))throw Error('AFP_RECORD_MISMATCH');
 checks.push('AFP-detail');
 await root.getByRole('button',{name:'목록으로 돌아가기',exact:true}).click();
 await root.getByRole('button',{name:'전체',exact:true}).click();
 await root.getByRole('button',{name:'최근 기록만 보기',exact:true}).click();
 for(const width of (mobile?[390,360,320]:[1440,1024,768])){
  await page.setViewportSize({width,height:1000});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('RECORDS_OVERFLOW_'+width);
  checks.push('width-'+width);
 }
 await page.setViewportSize({width:mobile?390:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await root.getByRole('button',{name:'‹ 내 지갑으로',exact:true}).click();
 await page.locator('.mq-wallet-home:visible').waitFor({state:'visible'});checks.push('return-wallet-reduced-motion');
 await page.locator('[data-wallet-route=records]:visible').click();
 await root.getByRole('button',{name:'전체',exact:true}).click();
 // Preview is real signed DICOM only; record unavailable pixels separately.
 await root.locator('.health-preview-label').waitFor({state:'visible'});
 const preview=await root.locator('.health-featured-image').evaluate(e=>({visible:!e.hidden,width:e.naturalWidth,height:e.naturalHeight}));
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/records-sheet-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:!mobile,animations:'disabled'});
 return {scope:'RECORDS_UI_ONLY',mobile,checks,result:'PASS',preview,review:'DRAFT / UNASSIGNED',clinicalInterpretationVerified:false};
}
