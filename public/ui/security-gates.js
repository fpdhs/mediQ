// Educational descriptions, not runtime verification results.
export const SECURITY_GATES = [
  {name:'본인 확인',title:'지금 요청한 사람이 맞나요?',check:'환자·의료진의 인증과 역할, 소속 기관을 확인합니다.',block:'다른 사용자로 가장하거나 권한 없는 역할로 요청하는 접근',where:'인증 경로 · Control',tech:'인증 · 역할 분리',example:'인증되지 않은 요청은 여기서 멈춥니다.',limit:'개발용 인증을 실제 IdP·생체인증으로 주장하지 않습니다.'},
  {name:'공유 결정',title:'누구에게, 어디까지 허용했나요?',check:'수신 병원·목적·Study/Series·허용 행위·유효기간과 명시적 동의를 확인합니다.',block:'동의가 없거나 철회된 공유를 이용하는 요청',where:'환자 화면 · Control',tech:'명시적 동의 · 최소 권한',example:'동의가 없으면 영상을 공유하지 않습니다.',limit:'동의 화면 표시만으로 서버 승인 여부를 판단하지 않습니다.'},
  {name:'병원 연결',title:'이 연결 정보를 다시 써도 될까요?',check:'QR/Ticket의 유효기간과 사용 상태를 확인합니다. 접수와 영상 접근은 다릅니다.',block:'만료되거나 이미 사용한 연결 정보의 재사용',where:'환자 QR · B 접수 · Control',tech:'단기 연결 정보 · 재사용 방지',example:'이미 사용된 연결 정보는 재사용을 제한합니다.',limit:'QR가 화면에서 사라진 것만으로 서버 차단을 증명하지 않습니다.'},
  {name:'접근 심사',title:'이번 요청도 승인 범위 안인가요?',check:'기관·의료진·목적·검사 범위·기간·동의 상태를 서버에서 함께 검증합니다.',block:'B병원 동의로 C병원이 요청하거나 다른 Series를 조회하는 접근',where:'Control · A Gateway',tech:'RBAC + ABAC · Fail Closed',example:'기관이나 검사 범위가 다르면 접근을 거부합니다.',limit:'버튼 비활성화는 서버 권한 검증을 대신하지 않습니다.'},
  {name:'임시 출입권',title:'출입권을 다른 사람이 가져가면요?',check:'단기 토큰의 서명·만료·범위를 확인하고 적용 경로에서는 DPoP 증명과 재사용도 검증합니다.',block:'변조·만료 토큰, DPoP 누락·재사용',where:'요청 클라이언트 · Gateway · 검증 서버',tech:'단기 토큰 · DPoP · Replay 방지',example:'유효하지 않은 토큰이나 재사용된 증명은 차단합니다.',limit:'DPoP는 적용 프로파일의 증적으로 확인해야 합니다. 모든 경로에 적용됐다고 가정하지 않습니다.'},
  {name:'보호된 전달',title:'영상과 키는 어떻게 보호하나요?',check:'통신은 TLS, 구성된 내부 구간은 mTLS로 보호합니다. 분산 암호화 경로는 Key Vault의 키 사용 승인과 영상 복호화 권한을 확인합니다.',block:'신뢰하지 않는 인증서·승인되지 않은 키 사용',where:'A/B Gateway · Control · Key Vault',tech:'TLS / mTLS · 영상 암호화 · 키 사용 승인',example:'인증서나 키 사용 승인이 유효하지 않으면 전달을 중단합니다.',limit:'로컬 보관의 KEK 방식과 분산 Key Vault 경로는 다릅니다. 최신 배포별 검증은 이 화면에서 수행하지 않습니다.'},
  {name:'열람·보관',title:'볼 수 있으면 저장도 가능한가요?',check:'열람과 다운로드 권한을 구분하고 필요한 Study/Series/Instance/Frame만 요청합니다. 보관은 저장 암호화·무결성·기간 확인이 별도로 필요합니다.',block:'열람 전용 동의로 다운로드·보관하는 요청',where:'B Viewer · 보관 서비스 · Gateway',tech:'VIEW_ONLY / DOWNLOAD_ALLOWED · 최소 전송',example:'열람 전용 공유는 병원 보관을 허용하지 않습니다.',limit:'B VM 영구보관·Key Vault 통합 완료를 뜻하지 않습니다. Viewer 표시와 파일 저장은 별도 결과입니다.'},
  {name:'접근 종료',title:'취소하거나 기간이 끝나면요?',check:'철회·만료 후 접근을 차단하고 보관정책에 따라 삭제 처리·실패 재시도·완료 확인을 구분합니다.',block:'철회·만료된 권한으로 새롭게 접근하는 요청',where:'Control · Gateway · 보관 정리 작업',tech:'철회 · 만료 · 삭제 상태 · 감사',example:'접근은 차단돼도 삭제 실패는 별도로 남겨 재시도합니다.',limit:'이미 열람한 내용까지 회수할 수는 없습니다. 논리적 삭제와 백업·물리적 소거는 다릅니다.'},
];
const illustrationNames=['identity','consent','ticket','policy','token','encryption','view-storage','expiry'];
const illustrationAlts=[
  '신분 카드와 소속 병원을 확인하는 관문',
  '파란 의료지갑에서 선택한 영상 카드와 공유할 병원·기간을 나타내는 입체 일러스트',
  '시간이 제한된 일회용 연결표와 재사용 차단 장면',
  '기관·사용자·목적·범위·기간·동의 조건을 함께 확인하는 관문',
  '요청자에게 연결된 임시 출입권과 유효기간',
  '암호화된 영상 전달 경로와 별도로 관리하는 키',
  '영상 열람과 별도 허용이 필요한 병원 보관의 두 갈래',
  '접근 차단과 별도로 진행하는 삭제 상태 확인',
];
SECURITY_GATES.forEach((gate,index)=>Object.assign(gate,{
  image:index===1 ? '/assets/security-journey/consent-v2.png' : `/assets/security-journey/${illustrationNames[index]}-v1.webp`,
  imageAlt:illustrationAlts[index],
}));
