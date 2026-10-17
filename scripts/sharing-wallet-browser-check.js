async (page) => {
 const mobile=new URL(page.url()).pathname.startsWith('/mobile');
 const checks=[];
 const home=page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]');
 await home.click();
 await page.locator('[data-wallet-route=sharing]:visible').click();
 if(mobile){
  await page.locator('#tab-share').getByText('내 영상을, 필요한 병원에.',{exact:true}).waitFor();
  await page.locator('#btn-wizard-to-2').click();
  await page.locator('#select-share-purpose').selectOption('TRANSFER');
  await page.locator('#btn-wizard-to-3').click();
  if(await page.locator('#confirm-purpose-label').innerText()!=='전원')throw Error('PURPOSE_REVIEW_MISMATCH');
  checks.push('mobile-transfer-review-no-approval');
 }else{
  await page.locator('.sharing-paper').waitFor();
  await page.locator('#sharing-target').selectOption('HOSP-B');
  await page.locator('#sharing-purpose').selectOption('TRANSFER');
  if(!(await page.locator('#sharing-summary-values').innerText()).includes('전원'))throw Error('SUMMARY_PURPOSE');
  await page.locator('#sharing-permission').selectOption('DOWNLOAD_ALLOWED');
  if(!(await page.locator('#sharing-summary-values').innerText()).includes('열람·다운로드'))throw Error('SUMMARY_PERMISSION');
  await page.locator('#sharing-permission').selectOption('VIEW_ONLY');
  await page.locator('#sharing-until').fill('');
  if(!await page.locator('#sharing-prepare').isDisabled())throw Error('INVALID_PERIOD_ENABLED');
  await page.locator('#sharing-until').fill('2026-10-19T10:00');
  await page.locator('#sharing-prepare').click();
  await page.locator('[data-page=consent]:visible').waitFor();
  if(await page.locator('#access-purpose-select').inputValue()!=='TRANSFER')throw Error('TRANSFER_NOT_PROPAGATED');
  if(await page.locator('#share-review-ack').isChecked())throw Error('IMPLICIT_APPROVAL');
  checks.push('live-summary-invalid-period-explicit-review');
  await home.click();await page.locator('[data-wallet-route=sharing]:visible').click();
 }
 for(const width of mobile?[390,360,320]:[1440,1024,768]){
  await page.setViewportSize({width,height:1000});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('OVERFLOW_'+width);
  checks.push('width-'+width);
 }
 await page.setViewportSize({width:mobile?390:1440,height:1000});
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/sharing-wallet-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true,animations:'disabled'});
 await home.click();await page.locator('[data-wallet-route=records]:visible').click();
 await page.locator('.health-wallet-sheet:visible').waitFor();
 const leather=await page.locator('.health-hero:visible').evaluate(el=>getComputedStyle(el).backgroundImage);
 if(!leather.includes('mediq-wallet-leather'))throw Error('RECORDS_LEATHER_MISSING');
 const clear=await page.locator('.health-wallet-sheet:visible').evaluate(el=>{const hero=el.querySelector('.health-hero'),row=el.querySelector('.health-record');return !row||row.getBoundingClientRect().top>=hero.getBoundingClientRect().bottom;});
 if(!clear)throw Error('RECORDS_LEATHER_OVERLAP');
 checks.push('records-shared-leather-surface');
 await page.screenshot({path:'C:/Users/user/Documents/New project/output/playwright/records-wallet-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true,animations:'disabled'});
 return {review:'DRAFT / UNASSIGNED',scope:'SHARING_REVIEW_UI_ONLY',mobile,checks,consentCreated:false,QRVerified:false,pixelsVerified:false};
}
