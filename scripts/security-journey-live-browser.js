async(page)=>{
  const {execFileSync}=await import('node:child_process');
  const program="import importlib.util,pathlib; p=pathlib.Path('scripts/capstone-a-gateway-ops.py'); s=importlib.util.spec_from_file_location('g',p);g=importlib.util.module_from_spec(s);s.loader.exec_module(g); import paramiko,os; c=paramiko.SSHClient();i=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud';c.load_host_keys(str(i/'known_hosts'));c.set_missing_host_key_policy(paramiko.RejectPolicy());c.connect('138.91.2.60',username='highpassadmin',key_filename=str(i/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10); f=g.root_sftp(c); key=f.open('/opt/highpass/capstone-control-secrets/capstone-login-key','rb'); import sys;sys.stdout.buffer.write(key.read(129));key.close();f.close();c.close()";
  let secret='';
  try {secret=execFileSync('python',['-c',program],{cwd:'C:/Users/user/Documents/New project',timeout:30000,stdio:['ignore','pipe','ignore']}).toString().trim();}
  catch {throw Error('APPROVED_PRESENTER_KEY_UNAVAILABLE');}
  if(!secret||secret.length>128)throw Error('CREDENTIAL_LENGTH');
  await page.locator('#capstone-login-key').fill(secret);
  secret='';
  await page.getByRole('button',{name:'B대학병원 의료진으로 시작',exact:true}).click();
  await page.locator('#capstone-login').waitFor({state:'hidden',timeout:20000});
  await page.locator('[data-view="exchange"]').click();
  await page.locator('[data-journey-overview]').waitFor({state:'visible'});
  await page.locator('[data-journey-gallery] img').evaluateAll(async images=>Promise.all(images.map(img=>img.decode())));
  const srcs=[];
  await page.locator('[data-journey-overview] [data-journey-gate="0"]').click();
  for(let i=0;i<8;i++){
    await page.locator(`.journey-steps [data-journey-gate="${i}"]`).click();
    await page.locator('[data-journey-image]').evaluate(img=>img.decode());
    srcs.push(await page.locator('[data-journey-image]').getAttribute('src'));
  }
  if(new Set(srcs).size!==8)throw Error('LIVE_IMAGES_NOT_DISTINCT');
  await page.locator('[data-journey-home]').click();
  const widths=[];
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('LIVE_OVERFLOW');
    widths.push(width);
    if(width!==320)await page.screenshot({path:`C:/Users/user/Documents/New project/output/playwright/security-gates-b-home-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  return {status:'PASS',scope:'REAL_B_BROWSER_LOGIN_AND_EXPLANATION_UI',distinctImages:new Set(srcs).size,widths};
}
