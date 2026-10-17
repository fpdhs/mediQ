// Patient-only capability and proof key live in RAM. No doctor-token fallback.
const uid=value=>typeof value==='string' && value.length<=64 && /^[0-9]+(?:\.[0-9]+)+$/.test(value)
  && value.split('.').every(part=>part==='0'||!part.startsWith('0'));
const base64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');

export async function createPatientPixelSession({patientId,study,seriesInstanceUid,headers,origin=location.origin,fetcher=fetch,webCrypto=crypto,clock=Date.now,signal}){
  const allowedSeries=study?.series?.map(row=>row?.seriesInstanceUid)??[];
  const series=seriesInstanceUid??allowedSeries[0];
  const parsedOrigin=new URL(origin);
  if(parsedOrigin.origin!==origin)throw new Error('PATIENT_VIEWER_UNAVAILABLE');
  const imageOrigin=origin==='https://highpass-demo.japaneast.cloudapp.azure.com'
    ?'https://highpass-images-b.japaneast.cloudapp.azure.com':origin;
  if(!patientId || !uid(study?.studyInstanceUid) || !uid(series) || new URL(origin).protocol!=='https:' || !webCrypto.subtle)
    throw new Error('PATIENT_VIEWER_UNAVAILABLE');
  if(!allowedSeries.includes(series))throw new Error('PATIENT_VIEWER_SCOPE_INVALID');
  const key=await webCrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const jwk=await webCrypto.subtle.exportKey('jwk',key.publicKey);
  let token='',expiresAt=0,closed=false;
  const request=async(path,{method='GET',body,issuance=false}={})=>{
    if(closed || (!issuance && clock()>=expiresAt))throw new Error('PATIENT_VIEWER_EXPIRED');
    const requestOrigin=issuance?origin:imageOrigin;
    const url=new URL(path,requestOrigin);
    if(url.origin!==requestOrigin || url.search || url.hash)throw new Error('PATIENT_VIEWER_UNAVAILABLE');
    const payload={jti:webCrypto.randomUUID(),htm:method,htu:url.origin+url.pathname,iat:Math.floor(clock()/1000)};
    const h=new Headers(issuance?headers:{authorization:'DPoP '+token});
    if(!issuance)payload.ath=base64(await webCrypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
    const input=base64(new TextEncoder().encode(JSON.stringify({typ:'dpop+jwt',alg:'ES256',jwk})))+'.'+base64(new TextEncoder().encode(JSON.stringify(payload)));
    h.set('dpop',input+'.'+base64(await webCrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key.privateKey,new TextEncoder().encode(input))));
    if(body)h.set('content-type','application/json');
    const response=await fetcher(url.href,{method,headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store',referrerPolicy:'no-referrer',credentials:'omit',redirect:'error',
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});
    if(closed || (!issuance && clock()>=expiresAt))throw new Error('PATIENT_VIEWER_EXPIRED');
    if(!response.ok){
      // A disabled public route is a connection problem, not proof of a wrong account.
      let code;try{code=(await response.json()).error;}catch{}
      throw new Error(code==='PUBLIC_ROUTE_NOT_ENABLED'?'PATIENT_VIEWER_ROUTE_UNAVAILABLE':
        response.status===401?(issuance?'PATIENT_VIEWER_LOGIN_REQUIRED':'PATIENT_VIEWER_EXPIRED'):
        response.status===403?'PATIENT_VIEWER_DENIED':'PATIENT_VIEWER_UNAVAILABLE');
    }
    return response;
  };
  try{
    const issued=await (await request(`/api/patients/${encodeURIComponent(patientId)}/studies/${study.studyInstanceUid}/self-view-grants`,
      {method:'POST',body:{seriesInstanceUids:[series]},issuance:true})).json();
    expiresAt=Date.parse(issued.expiresAt);
    let claims;try{claims=JSON.parse(atob(issued.accessToken.split('.')[1].replaceAll('-','+').replaceAll('_','/')));}catch{}
    if(issued.tokenType!=='DPoP' || issued.permission!=='VIEW_ONLY' || typeof issued.accessToken!=='string'
      || issued.accessToken.length>8192 || !Number.isFinite(expiresAt) || expiresAt<=clock()
      || !Number.isSafeInteger(claims?.iat) || !Number.isSafeInteger(claims?.exp) || claims.exp<=claims.iat
      || claims.exp-claims.iat>300 || expiresAt!==claims.exp*1000)
      throw new Error('PATIENT_VIEWER_UNAVAILABLE');
    token=issued.accessToken;
    const root=`/patient-dicomweb/studies/${study.studyInstanceUid}/series/${series}`;
    const rows=await (await request(root+'/instances')).json();
    if(!Array.isArray(rows) || !rows.length || rows.length>1000)throw new Error('PATIENT_VIEWER_UNAVAILABLE');
    const instances=rows.map(row=>{
      if(row['0020000D']?.Value?.[0]!==study.studyInstanceUid || row['0020000E']?.Value?.[0]!==series
        || !uid(row['00080018']?.Value?.[0]))throw new Error('PATIENT_VIEWER_SCOPE_INVALID');
      return row['00080018'].Value[0];
    });
    if(new Set(instances).size!==instances.length)throw new Error('PATIENT_VIEWER_SCOPE_INVALID');
    return {count:instances.length,expiresAt,seriesInstanceUid:series,
      async frame(index){
        if(!Number.isInteger(index) || index<0 || index>=instances.length)throw new Error('PATIENT_VIEWER_SCOPE_INVALID');
        const response=await request(root+'/instances/'+instances[index]+'/rendered');
        const type=response.headers.get('content-type')?.split(';')[0];
        if(!['image/png','image/jpeg'].includes(type))throw new Error('PATIENT_VIEWER_UNAVAILABLE');
        const blob=await response.blob();
        if(closed || clock()>=expiresAt || !blob.size || blob.size>8*1024*1024)throw new Error('PATIENT_VIEWER_UNAVAILABLE');
        return blob;
      },close(){closed=true;token='';}};
  }catch(error){closed=true;token='';throw error;}
}

// Polling can replace the launcher while the modal is open. Resolve only the
// same explicit action inside its original stable container, never another Study.
export function capturePatientViewerFocus(document,focus=document.activeElement){
  const attributes=['id','data-patient-view','data-action-view-study','data-patient-view-home','data-action-cine'];
  const identity=attributes.map(name=>[name,focus?.getAttribute?.(name)]).find(([,value])=>value);
  const container=focus?.parentElement?.closest?.('[id]'),containerId=container?.id;
  const usable=element=>element?.isConnected && !element.disabled && !element.closest?.('[inert]')
    && element.getClientRects().length>0;
  return ()=>{
    if(usable(focus)){focus.focus();return;}
    if(!identity)return;
    const root=containerId?document.getElementById(containerId):document;
    const replacement=Array.from(root?.querySelectorAll(`[${identity[0]}]`)??[])
      .find(element=>element.getAttribute(identity[0])===identity[1] && usable(element));
    replacement?.focus();
  };
}

export function patientViewerErrorMessage(error){
  return ({
    PATIENT_VIEWER_ROUTE_UNAVAILABLE:'영상 열람 서비스가 아직 연결되지 않았습니다. 로그인 문제가 아니며, 서비스 연결 확인이 필요합니다.',
    PATIENT_VIEWER_LOGIN_REQUIRED:'로그인 시간이 만료되었거나 인증을 확인하지 못했습니다. 닫고 다시 로그인해 주세요.',
    PATIENT_VIEWER_EXPIRED:'안전한 열람 시간이 끝났습니다. 다시 불러오면 본인 열람 권한을 새로 확인합니다.',
    PATIENT_VIEWER_DENIED:'이 계정의 본인 열람 권한을 확인하지 못했습니다. 계정과 검사 연결 확인이 필요합니다.',
    PATIENT_VIEWER_SCOPE_INVALID:'선택한 검사 범위와 영상 정보가 일치하지 않아 열람을 중단했습니다.',
  })[error?.message] || '영상을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}

let activeClose;
export async function openPatientPixelViewer({patientId,study,headers}){
  activeClose?.();
  if(!document.getElementById('patient-pixel-viewer-style')){
    const sheet=document.createElement('link');sheet.id='patient-pixel-viewer-style';sheet.rel='stylesheet';sheet.href='/ui/patient-pixel-viewer.css';document.head.append(sheet);
  }
  const restoreFocus=capturePatientViewerFocus(document),dialog=document.createElement('dialog'),abort=new AbortController();
  dialog.id='patient-pixel-viewer';dialog.setAttribute('aria-labelledby','patient-pixel-title');
  const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text)el.textContent=text;return el;};
  const header=node('header','patient-pixel-header'),heading=node('div','patient-pixel-heading');
  const title=node('h2','',study.modality==='CT'&&study.description?.includes('복부')?'복부 CT':study.modality||'내 의료영상');title.id='patient-pixel-title';
  heading.append(title,node('p','',`${study.studyDate||'검사일 확인 필요'} · ${{'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'가상 병원 C'}[study.sourceHospitalId]||'촬영 병원 확인 필요'}`));
  header.append(heading);
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.className='patient-pixel-status';
  status.textContent='본인 열람 권한과 영상 목록을 확인하고 있습니다…';
  const image=document.createElement('img');image.alt='승인된 합성 DICOM에서 조회한 영상';image.hidden=true;
  image.draggable=false;
  const canvas=node('div','patient-pixel-canvas');canvas.append(image);
  const label=node('p','patient-pixel-disclaimer','합성 시연 영상 · 비진단용 · 열람 전용 · 다운로드 불가');
  const seriesLabel=document.createElement('label');seriesLabel.textContent='영상 시리즈 ';
  const seriesSelect=document.createElement('select');seriesSelect.setAttribute('aria-label','영상 시리즈 선택');
  const seriesRows=Array.isArray(study.series)?study.series:[];
  for(const [index,row] of seriesRows.entries()){
    const option=document.createElement('option');option.value=row.seriesInstanceUid;
    option.textContent=row.description||`Series ${index+1}`;seriesSelect.append(option);
  }
  seriesLabel.append(seriesSelect);seriesLabel.hidden=seriesRows.length<2;
  const controls=node('footer','patient-pixel-controls'),toolbar=node('div','patient-pixel-toolbar'),navigation=node('div','patient-pixel-navigation');
  const button=(text,parent=toolbar)=>{const b=node('button','',text);b.type='button';parent.append(b);return b;};
  const closeButton=button('닫기',header),previous=button('이전 영상',navigation),next=button('다음 영상',navigation);
  closeButton.id='patient-pixel-close';previous.id='patient-pixel-previous';next.id='patient-pixel-next';
  const counter=node('output','patient-pixel-counter','— / —');navigation.insertBefore(counter,next);
  const slider=document.createElement('input');slider.type='range';slider.min='1';slider.max='1';slider.value='1';slider.disabled=true;slider.setAttribute('aria-label','영상 장수 이동');
  const zoomOut=button('축소'),zoomReset=button('100%'),zoomIn=button('확대'),full=button('전체화면'),retry=button('다시 불러오기');
  retry.hidden=true;full.hidden=!dialog.requestFullscreen;
  zoomReset.setAttribute('aria-label','확대 비율 초기화');
  controls.append(navigation,slider,toolbar,label);
  previous.disabled=next.disabled=true;
  dialog.append(header,seriesLabel,canvas,status,controls);document.body.append(dialog);dialog.showModal();closeButton.focus();
  let session,sessionAbort,url,timer,index=0,closed=false,busy=false,generation=0,zoom=1;
  const setZoom=value=>{zoom=Math.max(1,Math.min(3,value));image.style.width=`${zoom*100}%`;image.style.height=`${zoom*100}%`;zoomReset.textContent=`${Math.round(zoom*100)}%`;};
  zoomIn.onclick=()=>setZoom(zoom+.25);zoomOut.onclick=()=>setZoom(zoom-.25);zoomReset.onclick=()=>setZoom(1);
  full.onclick=async()=>{try{if(document.fullscreenElement===dialog)await document.exitFullscreen();else await dialog.requestFullscreen();}catch{status.textContent='이 브라우저에서는 전체화면을 사용할 수 없습니다.';}};
  const disable=()=>{previous.disabled=next.disabled=slider.disabled=zoomIn.disabled=zoomOut.disabled=zoomReset.disabled=true;};
  disable();
  const clear=()=>{image.removeAttribute('src');image.hidden=true;if(url)URL.revokeObjectURL(url);url=undefined;};
  const close=()=>{if(closed)return;closed=true;generation++;abort.abort();sessionAbort?.abort();clearTimeout(timer);session?.close();clear();window.removeEventListener('pagehide',close);dialog.close();dialog.remove();
    if(activeClose===close)activeClose=undefined;restoreFocus();};
  activeClose=close;closeButton.onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  window.addEventListener('pagehide',close);
  const fail=error=>{generation++;sessionAbort?.abort();clearTimeout(timer);clear();session?.close();disable();busy=false;counter.textContent='— / —';status.dataset.state='error';
    retry.hidden=!seriesRows.length;status.textContent=patientViewerErrorMessage(error);};
  const load=async()=>{
    if(closed || busy)return;busy=true;const version=++generation;disable();clear();status.dataset.state='loading';status.textContent='승인된 영상을 불러오고 있습니다…';
    try{const blob=await session.frame(index);if(closed||version!==generation)return;url=URL.createObjectURL(blob);image.src=url;
      let decodeTimer;try{await Promise.race([image.decode(),new Promise((_,reject)=>{decodeTimer=setTimeout(()=>reject(new Error('PATIENT_VIEWER_UNAVAILABLE')),5000);})]);}
      finally{clearTimeout(decodeTimer);}if(closed||version!==generation)return;
      if(Date.now()>=session.expiresAt)throw new Error('PATIENT_VIEWER_EXPIRED');
      image.hidden=false;status.dataset.state='ready';status.textContent='본인 열람 권한을 확인한 영상입니다.';
      counter.textContent=`${index+1} / ${session.count}`;slider.max=String(session.count);slider.value=String(index+1);slider.setAttribute('aria-valuetext',`${session.count}장 중 ${index+1}번째 영상`);
      slider.disabled=zoomIn.disabled=zoomOut.disabled=zoomReset.disabled=false;
      previous.disabled=index===0;next.disabled=index===session.count-1;
    }catch(error){if(!closed&&version===generation)fail(error);}finally{if(version===generation)busy=false;}
  };
  previous.onclick=()=>{if(!busy&&index>0){index--;load();}};
  next.onclick=()=>{if(!busy&&index<session.count-1){index++;load();}};
  slider.onchange=()=>{if(!busy&&session){index=Number(slider.value)-1;load();}};
  const selectSeries=async seriesUid=>{
    if(closed||!seriesRows.some(row=>row.seriesInstanceUid===seriesUid))return;
    const version=++generation;busy=true;disable();retry.hidden=true;seriesSelect.disabled=true;clear();clearTimeout(timer);setZoom(1);
    sessionAbort?.abort();session?.close();session=undefined;sessionAbort=new AbortController();index=0;
    status.textContent='선택한 시리즈의 본인 열람 권한을 확인하고 있습니다…';
    try{
      const created=await createPatientPixelSession({patientId,study,seriesInstanceUid:seriesUid,headers,signal:AbortSignal.any([abort.signal,sessionAbort.signal])});
      if(closed||version!==generation||sessionAbort.signal.aborted){created.close();return;}
      session=created;seriesSelect.disabled=false;busy=false;
      timer=setTimeout(()=>{if(!closed)fail(new Error('PATIENT_VIEWER_EXPIRED'));},Math.max(0,session.expiresAt-Date.now()));
      await load();
    }catch(error){if(!closed&&version===generation){seriesSelect.disabled=false;busy=false;fail(error);}}
  };
  retry.onclick=()=>selectSeries(seriesSelect.value||seriesRows[0]?.seriesInstanceUid);
  seriesSelect.addEventListener('change',()=>selectSeries(seriesSelect.value));
  if(!seriesRows.length){fail(new Error('PATIENT_VIEWER_UNAVAILABLE'));return;}
  await selectSeries(seriesSelect.value||seriesRows[0].seriesInstanceUid);
}
