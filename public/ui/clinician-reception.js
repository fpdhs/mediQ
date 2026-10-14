// Input presentation only. Existing authenticated server redemption remains authoritative.
export function imageInputAllowed(file) {
  return !!file && ['image/png','image/jpeg','image/webp'].includes(file.type) && file.size>0 && file.size<=8*1024*1024;
}
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
export function initializeReceptionHome(root, isActive=()=>true) {
  if(!root)return;
  document.querySelector('#clinical-home h2').textContent='접수 데스크';
  root.querySelector('h2').textContent='QR로 연결하고, 진료를 시작하세요.';
  root.querySelector('.mq-title p').textContent='환자가 건넨 QR로 공유 범위를 확인하고 접수를 이어가세요.';
  const steps=root.querySelectorAll('.reception-steps li');
  ['01 · QR 읽기','02 · 공유 확인','03 · 접수 준비'].forEach((t,i)=>steps[i].textContent=t);
  const left=root.querySelector('.qr-scanner-layout > article');
  left.querySelector('h3').textContent='환자 QR 접수';
  left.querySelector('p').textContent='환자의 공유 QR 티켓을 카메라에 보여주세요.';
  const camera=root.querySelector('.reception-camera'),frame=camera.querySelector('.qr-scanner-frame'),actions=frame.nextElementSibling,form=root.querySelector('#qr-manual-form');
  left.insertBefore(frame,form);left.insertBefore(actions,form);camera.remove();
  const idle=el('div',null,'reception-scan-idle');idle.setAttribute('aria-hidden','true');
  idle.append(el('span','▦','reception-qr-symbol'),el('span','QR을 화면 안에 맞춰주세요'));frame.append(idle);
  root.querySelector('#btn-toggle-camera-scan').textContent='카메라로 스캔';
  const importButton=el('button','QR 불러오기','mq-btn reception-import-button');importButton.type='button';actions.append(importButton);
  const importer=el('details',null,'reception-import');importer.id='reception-import';
  importer.append(el('summary','QR 불러오기 · 이미지 또는 연결 코드'));
  const label=el('label','QR 이미지 선택 (PNG·JPG·WebP, 최대 8MB)'),file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.id='qr-image-input';label.htmlFor=file.id;
  const notice=el('p','이미지는 기기에서만 읽습니다. 서버 확인 전에는 접수되지 않습니다.');notice.setAttribute('role','status');
  importer.append(label,file,notice,form);left.append(importer);
  importButton.onclick=()=>{importer.open=!importer.open;importButton.setAttribute('aria-expanded',String(importer.open));if(importer.open)file.focus();};
  importButton.setAttribute('aria-controls',importer.id);importButton.setAttribute('aria-expanded','false');
  importer.addEventListener('toggle',()=>importButton.setAttribute('aria-expanded',String(importer.open)));
  const right=root.querySelector('.qr-scanner-layout > article:last-child');right.querySelector('h3').textContent='이번 접수 확인';
  const receipt=el('div',null,'reception-receipt');right.insertBefore(receipt,right.querySelector('.mq-statline'));
  const details=el('details',null,'reception-identifiers');details.append(el('summary','접수 확인 상세'));
  right.querySelectorAll('.mq-statline').forEach(n=>details.append(n));right.append(details);
  const next=el('div',null,'reception-next');
  for(const [view,text] of [['qr','접수 내용 보기']]){const b=el('button',text,'mq-btn');b.type='button';b.dataset.viewJump=view;next.append(b);}
  next.append(el('p','접수는 영상 전송·병원 보관 완료를 뜻하지 않습니다. 각 화면에서 접근 권한을 다시 확인합니다.'));
  right.insertBefore(next,right.querySelector('.reception-help'));
  const nextButton=next.querySelector('button');nextButton.classList.add('mq-btn-primary');nextButton.disabled=true;
  function update(row,patientName='공유 환자'){
    receipt.replaceChildren();nextButton.disabled=true;
    if(!row?.consent||row.status!=='CONSENT_ACTIVE'){
      receipt.append(el('div','QR','reception-wait-symbol'),el('h4','환자의 QR을 기다리고 있어요'),el('p','공유 확인이 끝나면 환자와 검사 정보가 여기에 나타납니다.'));return;
    }
    const c=row.consent,hospital=id=>({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id]||'공유 병원');
    receipt.append(el('span','공유 확인 완료','reception-confirmed'),el('h4',patientName),el('p','합성 시연 환자'),el('p',`${hospital(row.sourceHospitalId)} → ${hospital(row.targetHospitalId)}`,'reception-route'));
    for(const s of row.studies)receipt.append(el('div',`${s.description||s.modality||'공유 검사'} · ${s.studyDate||'검사일 확인 필요'}`,'reception-exam'));
    for(const [label,value] of [['공유 목적',({TRANSFER:'전원',TREATMENT:'진료',CONSULTATION:'협진'}[c.purpose]||'목적 확인')],['허용 범위','영상 열람'],['다운로드',c.permission==='DOWNLOAD_ALLOWED'?'허용':'허용 안 함'],['공유 종료',new Date(c.validUntil).toLocaleString('ko-KR')]]){
      const line=el('div',null,'reception-detail-row');line.append(el('span',label),el('strong',value));receipt.append(line);
    }
    nextButton.disabled=false;
  }
  update(null);
  let generation=0;
  const clear=()=>{generation++;file.value='';notice.textContent='이미지는 기기에서만 읽습니다. 서버 확인 전에는 접수되지 않습니다.';};
  root.querySelector('#btn-reset-qr-scan').addEventListener('click',()=>update(null));
  root.querySelector('#btn-reset-qr-scan').addEventListener('click',clear);window.addEventListener('pagehide',clear);
  new MutationObserver(()=>{if(root.hidden)clear();}).observe(root,{attributes:true,attributeFilter:['hidden']});
  file.addEventListener('change',async()=>{
    form.querySelector('input').value='';
    const selected=file.files?.[0],request=++generation;
    if(!imageInputAllowed(selected)){notice.textContent='8MB 이하의 PNG·JPG·WebP 이미지를 선택해 주세요.';return;}
    notice.textContent='QR 이미지를 읽고 있습니다…';let bitmap;
    try{
      bitmap=await createImageBitmap(selected);if(bitmap.width*bitmap.height>25000000)throw Error('IMAGE_TOO_LARGE');
      const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),decoded=window.jsQR?.(pixels.data,canvas.width,canvas.height);
      if(request!==generation||root.hidden||!isActive())return;
      if(!decoded?.data||decoded.data.length>2048)throw Error('QR_NOT_FOUND');
      const input=form.querySelector('input');input.value=decoded.data;delete input.dataset.demoImport;
      notice.textContent='QR을 읽었습니다. 아래 ‘공유 확인하고 접수’를 눌러 서버에서 확인하세요.';input.focus();
    }catch{if(request===generation)notice.textContent='QR을 읽지 못했습니다. 선명한 이미지 또는 환자가 전달한 연결 코드를 사용하세요.';}
    finally{bitmap?.close();file.value='';}
  });
  return {update,reset(){clear();update(null);}};
}
