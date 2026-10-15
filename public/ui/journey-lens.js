// Educational examples only. No patient state, network, tokens or audit writes.
export const GATE_LENSES = [
  {request:'의료진의 조회 요청',match:'인증 · 역할 · 소속',deny:'소속이 확인되지 않은 사용자',next:'요청 주체 확인 후 다음 검증',points:[
    ['요청자',37,53,'인증된 사용자인지 먼저 확인합니다. 이름이나 화면에 표시된 신분 카드만으로 본인 확인이 끝나지 않습니다.'],
    ['의료진 역할',53,49,'환자·의료진·관리자의 역할을 구분합니다. 역할에 맞지 않는 기능은 서버에서도 허용하지 않습니다.'],
    ['소속 병원',66,55,'로그인한 의료진의 소속과 요청 기관을 대조합니다. 다른 병원으로 바꿔 요청해도 권한이 따라오지 않습니다.']]},
  {request:'선택한 검사 공유',match:'범위 · 병원 · 목적 · 기간',deny:'환자가 철회한 동의',next:'동의 범위 확인 후 접근 심사',points:[
    ['내 의료지갑',34,54,'환자가 공유할 검사를 선택합니다. 이 그림의 지갑은 선택의 비유이며 원본 DICOM을 휴대폰이나 Control에 중앙 저장한다는 뜻은 아닙니다.'],
    ['선택한 영상',65,31,'허용한 Study와 Series만 공유 범위에 포함합니다. 한 검사의 동의가 다른 CT·MRI까지 허용하지 않습니다.'],
    ['병원과 기간',72,70,'누가, 어떤 목적으로, 언제까지 볼 수 있는지 정합니다. 조회 전용과 다운로드 허용은 별도 권한입니다.']]},
  {request:'공유 연결표 접수',match:'연결표 유효기간 · 사용 상태',deny:'이미 사용한 연결표',next:'접수 확인 후 별도 접근 심사',points:[
    ['연결표',46,44,'QR·Ticket은 공유 정보를 연결하기 위한 단기 정보입니다. 연결표를 읽었다고 영상 열람이 승인된 것은 아닙니다.'],
    ['유효기간',70,35,'시간이 지난 연결표는 새 접수에 사용할 수 없습니다. 화면의 타이머와 별도로 서버가 기간을 검사합니다.'],
    ['재사용 차단',74,73,'이미 사용된 연결 정보를 다시 제출하는 요청은 사용 상태에 따라 제한합니다. 같은 정보를 반복 스캔해도 권한은 늘어나지 않습니다.']]},
  {request:'선택한 Series 조회',match:'동의 · 기관 · 역할 · 범위 · 목적 · 시간',deny:'동의된 병원과 요청 병원 불일치',next:'모든 조건 확인 후 단기 토큰 단계',points:[
    ['여러 조건',46,30,'RBAC는 역할을, ABAC는 병원·동의·검사 범위·목적·기간 같은 요청 조건을 확인합니다. 하나만 맞는 것으로는 충분하지 않습니다.'],
    ['모두 일치',38,72,'서버가 모든 필수 조건을 확인해야 다음 단계로 진행합니다. 버튼 색상이나 프론트엔드 검사만으로 접근을 승인하지 않습니다.'],
    ['하나라도 불일치',79,64,'잘못된 병원, 다른 Series, 철회된 동의 중 하나라도 해당하면 거부합니다. 확인할 수 없는 경우에도 허용하지 않습니다.']]},
  {request:'임시 출입권으로 영상 요청',match:'서명 · 시간 · 범위 · 요청자 증명',deny:'만료되거나 다른 범위의 토큰',next:'Gateway 검증 후 허용 범위 요청',points:[
    ['단기 출입권',36,47,'접근정책 검증을 통과한 뒤 짧은 유효기간의 토큰을 발급합니다. 영구 URL이나 무기한 토큰으로 영상을 공개하지 않습니다.'],
    ['요청자 연결',67,46,'DPoP 적용 경로에서는 요청자의 키에 연결된 증명도 검사합니다. 적용되지 않은 경로까지 같은 보호가 있다고 가정하지 않습니다.'],
    ['시간과 범위',74,73,'유효기간, 병원, 사용자, Study·Series 범위를 대조합니다. 토큰이 있어도 그 범위를 벗어난 요청은 차단합니다.']]},
  {request:'허용 범위의 영상 전달',match:'보호된 통신 · 키 사용 승인',deny:'신뢰되지 않은 인증서 또는 키 사용',next:'적용된 암호화 경로로 필요한 영상 전달',points:[
    ['영상 경로',32,70,'원본은 제공 병원에 남습니다. 영상은 병원 Gateway 경로에서 필요한 범위만 전달되며 Control은 권한과 최소 메타데이터를 다룹니다.'],
    ['키 사용 승인',71,25,'분산 암호화 구성에서는 별도 Key Vault 경로로 키 사용을 승인합니다. 영상 원본 자체를 Key Vault로 보내는 것이 아닙니다.'],
    ['통신 보호',74,68,'외부 통신의 TLS와 구성된 내부 구간의 mTLS를 구분합니다. 어떤 구간에 적용됐는지는 해당 환경의 검증 결과로 확인해야 합니다.']]},
  {request:'열람 또는 병원 보관',match:'조회 권한과 다운로드 권한 분리',deny:'조회 전용 동의로 저장 요청',next:'요청 행위에 맞는 권한을 별도 확인',points:[
    ['영상 열람',68,27,'Viewer는 허용된 영상만 표시합니다. Study 전체를 자동 다운로드하기보다 Series·Instance·Frame 순서로 필요한 데이터를 요청합니다.'],
    ['병원 보관',68,73,'보관에는 다운로드 권한과 추가 검증이 필요합니다. 보관 후에도 저장 암호화·무결성·보관기간을 따로 확인해야 합니다.'],
    ['서로 다른 결과',32,48,'볼 수 있다는 것이 저장할 수 있다는 뜻은 아닙니다. Viewer 표시, 파일 수신, 무결성 확인을 하나의 성공으로 합치지 않습니다.']]},
  {request:'철회 또는 만료 후 접근',match:'동의 상태 · 기간 · 보관정책',deny:'철회된 권한으로 다시 조회',next:'상태 확인 후 허용 또는 차단 판단',points:[
    ['접근 차단',37,45,'동의가 철회되거나 만료되면 신규 접근을 제한합니다. 이미 사용자가 본 내용까지 회수할 수 있다는 뜻은 아닙니다.'],
    ['삭제 처리',72,62,'접근 차단과 저장된 자료의 삭제는 다른 단계입니다. 정책에 따른 대기·실패·재시도·완료를 구분해 기록합니다.'],
    ['감사 이력',72,27,'누가 언제 어떤 행위를 했는지 추적할 수 있어야 합니다. 자료 삭제가 감사로그의 임의 삭제를 의미하지 않습니다.']]},
];

export function gateLensModel(index,point=0,scenario='normal') {
  const gate=GATE_LENSES[Math.max(0,Math.min(7,Number.isInteger(index)?index:0))];
  const selected=Math.max(0,Math.min(2,Number.isInteger(point)?point:0));
  const denied=scenario==='denied',unavailable=scenario==='unavailable';
  return {gate,selected,point:gate.points[selected],tone:denied?'denied':unavailable?'unavailable':'normal',
    result:unavailable?'확인 보류 · 허용하지 않음':denied?'접근 차단 예시':'다음 검증 단계로',
    reason:unavailable?'서버 응답을 확인하지 못했습니다. 정책상 거부와 구분하고 권한은 허용하지 않습니다.':denied?gate.deny:gate.next};
}

export function mountJourneyLens(root) {
  const image=root.querySelector('[data-journey-image]');
  const figure=image?.closest('figure');if(!figure)return {update(){}};
  const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const frame=node('div','journey-image-frame');image.before(frame);frame.append(image);
  const pins=node('div','journey-image-pins');pins.setAttribute('role','group');pins.setAttribute('aria-label','그림 속 보안 요소');frame.append(pins);
  const insight=node('section','journey-insight'),title=node('h3','',''),copy=node('p','','');
  insight.setAttribute('aria-label','선택한 보안 요소');copy.id='journey-insight-copy';insight.setAttribute('aria-live','polite');insight.append(title,copy);figure.after(insight);
  let index=0,selected=0,scenario='normal';
  const buttons=Array.from({length:3},(_,i)=>{
    const button=node('button','journey-pin',String(i+1));button.type='button';button.setAttribute('aria-describedby',copy.id);
    button.addEventListener('click',()=>{selected=i;renderPoint();});pins.append(button);return button;
  });
  const comparison=node('section','journey-comparison');comparison.setAttribute('aria-label','보안 조건 비교');
  const head=node('div','journey-comparison-heading');head.append(node('h3','','조건이 달라지면'),node('span','journey-example-label','설명용 시뮬레이션'));
  const choices=node('div','journey-compare-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','비교할 설명용 상황');
  for(const [id,label] of [['normal','조건 일치'],['denied','조건 불일치'],['unavailable','응답 없음']]){
    const button=node('button','',label);button.type='button';button.dataset.journeyScenario=id;choices.append(button);
  }
  const route=node('ol','journey-compare-route'),values=[];
  for(const label of ['요청','확인 조건','설명 결과']){const li=node('li','');const value=node('strong','');li.append(node('small','',label),value);route.append(li);values.push(value);}
  const reason=node('p','journey-compare-reason');reason.setAttribute('role','status');
  comparison.append(head,choices,route,reason,node('small','journey-compare-boundary','설명만 전환합니다. 실제 접근 요청·토큰 발급·영상 전송은 실행하지 않습니다.'));
  root.querySelector('[data-journey-detail]').after(comparison);
  function renderPoint(){
    const model=gateLensModel(index,selected,scenario);
    for(const [i,button] of buttons.entries()){
      const [label,x,y]=model.gate.points[i];button.style.left=`${x}%`;button.style.top=`${y}%`;
      button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(i===selected));
    }
    title.textContent=model.point[0];copy.textContent=model.point[3];
  }
  image.addEventListener('error',()=>{pins.hidden=true;});image.addEventListener('load',()=>{pins.hidden=false;});
  return {update(model,overview){
    if(index!==model.index)selected=0;index=model.index;scenario=model.denied?'denied':model.unavailable?'unavailable':'normal';renderPoint();
    const view=gateLensModel(index,selected,scenario);comparison.hidden=overview;comparison.dataset.tone=view.tone;
    [view.gate.request,view.gate.match,view.result].forEach((text,i)=>{values[i].textContent=text;});reason.textContent=view.reason;
  }};
}
