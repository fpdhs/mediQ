# 환자 CT 공개 진입점 주소 복구

기준: 2026-10-16 20:54 KST. DRAFT / UNASSIGNED.

## 원인과 복구

환자 본인 권한 발급은 성공했지만 공개 영상 주소의 HTTPS 연결은 시간 초과였다.
Azure NIC의 `patient-images-b` IP 구성은 10.89.0.5로 존재했고, OS eth0에는
주 DHCP 주소 10.89.0.4만 남아 있었다. TCP socket은 10.89.0.5:443을 기다리고
있었지만 해당 주소가 인터페이스에 없어 외부 영상 연결이 도달하지 못했다.

Azure VM, Control/DB, 병원 A Gateway, B Portal/PACS, B TLS 및 WireGuard는 실행 중이었다.
B 암호화 PACS 마운트도 열려 있었다. 이번 장애는 환자 계정 또는 소유권 연결 실패로
판정하지 않는다. networkd 로그에는 06:33 UTC 네트워크 재설정이 있지만, 이 재설정의
상위 원인은 확정하지 않았다.

기존 `hp-patient-entry-network.service`를 재실행해 승인된 보조 주소를 복구했다.
재설정 후에도 주소를 유지하도록 기존 netplan 생성 network에 다음 drop-in을 적용했다.

- 저장소 원본: `infra/azure/patient-entry-secondary-address.conf`
- 서버: `/etc/systemd/network/10-netplan-eth0.network.d/60-highpass-patient-address.conf`
- 내용: `[Address] Address=10.89.0.5/32`
- SHA-256: `9ed3d94983ff3739f6788657c6a67a6b4af780ea6970d7e361649e728dd1238a`

networkctl reload 후 두 주소와 기존 DHCP 경로가 복구되는 것을 확인했다.
첫 검사는 비동기 DHCP 준비 완료 전에 주소를 확인하여 실패했다. 이후 유한 준비 대기를
추가했고 동일 적용·검사를 통과했다. 주 netplan 생성 파일의 해시는 그대로다.
앱 이미지, DB, 동의, Entra 매핑, NSG, 공개 허용 범위는 변경하지 않았다.

## 요구사항 및 API 영향

FR-006~009 목록, FR-014~025 접근정책·단기 토큰, FR-026~036 Gateway·Viewer,
FR-037~041 감사 경로 관련 운영 복구. API 계약과 데이터 모델 변경 없음.
기존 dirty DR 작업 및 증적·발표자료는 보존했다. 커밋·푸시는 수행하지 않았다.

## 검증

| 항목 | 결과 | 근거 |
|---|---|---|
| 환자 권한 발급 | PASS | 복구 전 최근 3시간 성공 9건, 정책 허용 감사 |
| Azure NIC / OS 주소 불일치 확인 | PASS | NIC 10.89.0.5 존재, 초기 OS에는 부재 |
| 보조 주소 복구와 영구 설정 | PASS | networkctl에서 drop-in 인식 및 두 주소 확인 |
| 네트워크 reload 후 재확인 | PASS | DHCP 주 주소와 보조 주소, 터널·영상 서비스 유지 |
| 공개 TLS·인증 거부·CORS | PASS | 기존 경계 검사 11/11 |
| 환자 Viewer 관련 집중 회귀 | PASS | pixel-viewer/public-origins/data-plane-gateway 20/20 |
| 복구 후 본인 영상 서버 처리 | PASS | ACCESS_ALLOWED/RESPONSE_PREPARED 각 4건, Key release consumed 2건 관측 |
| 이 도구의 실제 로그인 브라우저 CT 표시 | NOT VERIFIED | 자동 브라우저 표시 증적 없음 |
| 환자 실제 CT 표시 | PASS (사용자 확인) | 복구 후 사용자가 직접 의료영상 표시를 확인하고 검증 종료 요청 |
| VM 실제 재부팅 | NOT VERIFIED | 전체 서비스 재부팅은 수행하지 않음 |

서버 감사의 성공 집계는 해당 처리 성공만 의미하며 브라우저 픽셀 표시의 증거로 대체하지 않는다.
전체 700개 재해시·B 전량 전송은 이번 복구 범위가 아니다.

## 증적과 복구 절차

- `artifacts/azure/patient-ct-incident-20261016T115437Z/result.json`
- `artifacts/workstation/reboot-public-check-20261016T115254003962Z/result.json`
- 진단·주소 복구: `scripts/patient-ct-incident-20261016.py`
- B 읽기 전용 진단: `scripts/patient-ct-b-incident-20261016.py`

이 수정의 rollback은 새 drop-in 한 개만 제거하고 networkctl reload 후 기존 준비
서비스로 보조 주소를 재등록하는 절차다. 기존 DHCP 파일·서비스·NIC 자원은 삭제하지 않는다.
실제 rollback은 수행하지 않았다.
