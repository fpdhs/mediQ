async page=>{
 const mobile=new URL(page.url()).pathname.startsWith('/mobile/'),checks=[];
 const home=page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]');
 await home.click();await page.locator('[data-wallet-route=sharing]:visible').click();
 const surface=page.locator('.sharing-expanded-card:visible');await surface.waitFor();
 const dock=page.locator('.sharing-extracted-sheet:visible .mq-wallet-dock');
 if(await dock.locator('button').count()!==3||await dock.locator('[data-wallet-route=sharing]').count())throw Error('WRONG_REMAINING_CARDS');
 checks.push('three-remaining-cards');
 if(mobile){
  await page.locator('#btn-wizard-to-2').click();await page.locator('#select-share-purpose').selectOption('TRANSFER');await page.locator('#btn-wizard-to-3').click();
  if(await page.locator('#confirm-purpose-label').innerText()!=='전원')throw Error('PURPOSE');
  checks.push('explicit-review-without-approval');
  await page.locator('#btn-wizard-back-to-2').click();await page.locator('#btn-wizard-back-to-1').click();
 }else{
  await page.locator('#sharing-target').selectOption('HOSP-B');await page.locator('#sharing-purpose').selectOption('TRANSFER');
  if(!(await page.locator('#sharing-summary-values').innerText()).includes('전원'))throw Error('SUMMARY');checks.push('live-summary');
  await page.locator('#sharing-permission').selectOption('DOWNLOAD_ALLOWED');
  if(!(await page.locator('#sharing-summary-values').innerText()).includes('열람·다운로드'))throw Error('PERMISSION');
  await page.locator('#sharing-permission').selectOption('VIEW_ONLY');
  await page.locator('#sharing-until').fill('');if(!await page.locator('#sharing-prepare').isDisabled())throw Error('INVALID_PERIOD');checks.push('invalid-date-blocked');
  await page.locator('#sharing-until').fill('2026-10-19T10:00');await page.locator('#sharing-prepare').click();
  await page.locator('[data-page=consent]:visible').waitFor();if(await page.locator('#share-review-ack').isChecked())throw Error('IMPLICIT_APPROVAL');checks.push('explicit-review-without-approval');
  await home.click();await page.locator('[data-wallet-route=sharing]:visible').click();
 }
 for(const width of mobile?[390,360,320]:[1440,1024,768]){await page.setViewportSize({width,height:1000});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('OVERFLOW_'+width);checks.push('width-'+width);}
 await page.setViewportSize({width:mobile?390:1440,height:1000});
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/sharing-extracted-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true,animations:'disabled'});
 await dock.locator('[data-wallet-route=records]').click();await page.locator('.health-expanded-card:visible').waitFor();checks.push('records-dock-navigation');
 return {scope:'SHARING_CARD_UI_REAL_BACKEND',mobile,checks,consentCreated:false,QRVerified:false,review:'DRAFT / UNASSIGNED'};
}
