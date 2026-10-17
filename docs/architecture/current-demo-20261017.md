# 현재 시연 구성과 자료 기준

소개 자료 기준일: 2026-10-17. 아래 런타임 확인은 각 항목에 적힌 날짜의 증적 기준이다.

## 서비스와 소개 페이지

- GitHub Pages: https://sureasdufo1-hue.github.io/Highpass-Project/ (정적 포트폴리오)
- 환자·의료진·보안관리자 웹: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/
- 모바일 PWA: https://highpass-demo.japaneast.cloudapp.azure.com/mobile/
- 영상 HTTPS 진입점: B병원용 별도 주소. 원본·관리 API를 일반 공개하지 않는다.

승인된 Microsoft 계정으로 로그인하고 서버에서 합성 사용자 역할과 병원을 매핑한다.
로컬 개발 주소와 사설 병원 주소는 공개 서비스의 대체 로그인 링크로 사용하지 않는다.

## 제어와 영상 경로

Azure Japan East의 VM/Docker Compose에서 웹 진입점, Control API, PostgreSQL을 실행한다.
Caddy + Coraza/OWASP CRS가 WAF 역할을 한다. Azure 관리형 WAF를 배포했다는 주장이 아니다.
Key Vault는 키를 보호하고 지정된 Log Analytics 작업 공간으로 감사 이벤트를 수집한다.
Entra의 조회 결과와 진단 설정 권한은 별도 상태로 해석한다. 선택 기간의 0건은 무사고 증명이 아니다.

원본 DICOM은 가상 A병원 Orthanc에 유지한다. 동의·토큰·범위 확인 후 Gateway를 통해
승인 영상을 조회한다. B병원은 명시적 다운로드 허용 범위에서만 수신·암호화 보관한다.
공개 영상 소켓은 TLS 바이트를 전달하고 B병원에서 TLS를 종료한다. Control API는
원본 DICOM을 지속 저장하거나 애플리케이션 계층에서 영상 프록시를 수행하지 않는다.

## DR 및 장애 대응

2026-10-16: East Asia 대기 VM에서 PostgreSQL 비동기 streaming 복제, 관측 시 LSN 일치,
복구 모드·읽기 전용·쓰기 거부를 확인했다. Traffic Manager는 Priority/TTL 30초의 별도
검증 프로필로 Disabled 상태다. 주 서버 참조 엔드포인트만 있고 대기 앱 전환은 수행하지 않았다.
두 Key Vault는 Japan East에 있으므로 타 리전 키 복구는 추가 검증이 필요하다.

2026-10-16: NIC와 OS의 영상용 보조 IP 불일치로 환자 CT 연결이 끊긴 문제를 복구하고
networkd 영구 설정을 추가했다. 공개 경계 11/11, 환자 Viewer 집중 회귀 20/20을 확인했다.
이후 사용자가 환자 CT 실제 표시를 직접 확인하고 검증 종료를 요청했다. 이는 사용자 확인이며
자동 브라우저 표시 증적이나 700장 전량 전송 검증으로 확대하지 않는다.

근거 문서:

- [CT 연결 복구](../operations/patient-ct-secondary-address-recovery-2026-10-16.md)
- [DR 대기 준비](../operations/azure-dr-standby-preparation-2026-10-16.md)
- [DB 복제](../operations/azure-dr-standby-replication-2026-10-16.md)
- [Traffic Manager 검증 환경](../operations/azure-dr-traffic-manager-validation-2026-10-16.md)

## 자료의 한계

증적 ZIP의 화면은 시연 캡처이며 캡처 날짜가 확인되지 않은 파일에 임의 날짜를 붙이지 않았다.
소개 페이지의 수치·그래프는 실시간 조회가 아니다. APK는 디버그 TWA이며 스토어 출시나
네이티브 보안 저장소 구현을 뜻하지 않는다. B병원 700장 전량 수신, 실제 DR 전환,
RTO/RPO, 새 콜드부팅 및 실제 의료기관 운영은 별도 검증 대상이다.
