async(page)=>{
  const root='C:/Users/user/Documents/New project/';
  const html=await (await page.request.get('http://127.0.0.1:11448/index.html')).text();
  const styles=html.match(/<link[^>]+rel="stylesheet"[^>]*>/g).join('\n');
  const section=html.match(/<section class="mq-screen" id="clinical-desk"[\s\S]*?(?=\s*<!-- 2\.2 Cloud DICOM Viewer -->)/)[0];
  await page.goto('http://127.0.0.1:11448/preview');
  await page.setContent(`<html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="http://127.0.0.1:11448/">${styles}<body><div id="hospital-saas-app"><header class="mq-header"><strong>Medi Q</strong><span>진료 준비 · 로컬 디자인 검증 / 실제 로그인·PACS 검증 아님</span></header><main class="mq-main">${section}</main></div></body></html>`);
  await page.evaluate(async()=>{
    const ui=await import('/ui/clinician.js');
    const study={studyInstanceUid:'1.2.3',description:'복부 CT',modality:'CT',studyDate:'2026-10-10',sourceHospitalId:'HOSP-A'};
    const consent={status:'ACTIVE',targetHospitalId:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',validFrom:new Date(Date.now()-60000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString()};
    ui.renderClinicalDossier(document.querySelector('#clinical-dossier'),study,consent,{patientName:'홍길동',scenario:{age:56}});
    ui.renderClinicalStudyList(document.querySelector('#doctor-studies'),[study],study.studyInstanceUid,()=>consent);
    document.querySelector('#clinical-selected-title').textContent='복부 CT';
    document.querySelector('#clinical-preview-host').textContent='권한 확인 후 실제 영상 미리보기';
  });
  const results=[];
  for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1100});
    const ok=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
    results.push({width,result:ok?'PASS':'FAIL'});if(!ok)throw Error('overflow '+width);
    if(width===1440||width===390)await page.screenshot({path:root+`output/playwright/clinician-preparation-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1100});
  return {scope:'DESIGN_FIXTURE_ONLY',results};
}
