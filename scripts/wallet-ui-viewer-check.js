async (page) => {
  const mobile=new URL(page.url()).pathname.startsWith('/mobile');
  const home=mobile?'#tab-home':'#patient-portal-app [data-page=home]';
  await page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]').click();
  await page.locator(home+' [data-wallet-route=records]').click();
  const root=page.locator(mobile?'.mq-mobile-records':'#patient-health-records');
  await root.getByRole('button',{name:'CT / 영상 보기',exact:true}).click();
  const viewer=page.locator('#patient-pixel-viewer');
  const image=viewer.locator('img');await image.waitFor({state:'visible',timeout:20000});
  const before=await viewer.getByRole('status').innerText();
  await viewer.getByRole('button',{name:'다음 영상',exact:true}).click();
  await image.waitFor({state:'visible',timeout:20000});
  const after=await viewer.getByRole('status').innerText();
  const geometry=await image.evaluate(n=>({width:n.naturalWidth,height:n.naturalHeight}));
  if(!geometry.width||!geometry.height||before===after)throw new Error('PIXEL_OR_SLICE_NOT_CONFIRMED');
  await viewer.getByRole('button',{name:'닫기',exact:true}).click();
  await page.locator(mobile?'.mobile-nav [data-tab=home]':'#patient-portal-app .nav [data-route=home]').click();
  return {scope:'PATIENT_SELF_VIEW_ONLY',mobile,before,after,geometry,result:'PASS',hospitalTransferVerified:false};
}
