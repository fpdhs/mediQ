# Traffic Manager 별도 검증 환경 — 2026-10-16

검토 상태: **DRAFT / UNASSIGNED**. 범위 한정: **비활성 검증 프로필 생성 완료**.
이 문서는 실제 DR 전환 성공이나 운영 승인 증적이 아니다.

후속: [별도 East Asia VM·DB 복제 구성](azure-dr-standby-replication-2026-10-16.md)은 진행했지만,
이 검증 프로필은 계속 Disabled이며 대기 앱 endpoint/실제 사용자 라우팅을 추가하지 않았다.

## 작업 목적과 승인

사용자 승인: “기존 주소는 유지하고 Traffic Manager는 사용자 접속에 영향을 주지 않는
별도 검증 환경으로 먼저 구성”. 기존 준비 문서는
[대기 환경 준비](azure-dr-standby-preparation-2026-10-16.md)를 참조한다.

- 확인된 요구사항: 기존 주소·인증·환자/의료진 서비스를 전환하거나 중단하지 않는다.
- 합리적 가정: 먼저 비활성 프로필을 생성하고 실제 대기 서버가 준비되기 전에는 라우팅하지 않는다.
- 구현 결정: 별도 RG에 새 프로필만 생성; 기존 서버 참조 엔드포인트도 Disabled.
- 남은 불확실성: 타 리전 서버, 공통 HTTPS 주소, 키 복구 범위, DB 복제와 승격은 미확정·미구현.
- 관련 영향 검토: FR-014~025 접근정책·토큰, FR-026~036 영상 경로·뷰어,
  FR-037~041 감사. 해당 업무 API 및 데이터 모델은 변경하지 않았다.
  DR 전용 요구사항 ID와 NFR 매핑은 아직 승인 배정되지 않았다.

## 실제 생성한 구성

| 항목 | 값 |
|---|---|
| 구독 | 기존 Azure for Students 승인 구독 |
| 전용 리소스 그룹 | rg-highpass-dr-validation-20261016 (메타데이터 위치 Japan East) |
| 프로필 | highpass-dr-lab-4869edd9 (global) |
| DNS 이름 | highpass-dr-lab-4869edd9.trafficmanager.net |
| 라우팅 방식 | Priority |
| 프로필 상태 | Disabled |
| TTL | 30초 |
| 참조 엔드포인트 | primary-reference-disabled, priority=1, Disabled |
| 참조 대상 | highpass-demo.japaneast.cloudapp.azure.com |
| 상태 검사 설정 | HTTPS 443 /, 30초 간격; **비활성이므로 실제 probe 없음** |
| Traffic View | Disabled |
| priority=2 대기 엔드포인트 | 없음 — 준비되지 않은 주소를 만들어 넣지 않음 |

검증용 DNS는 비활성 상태에서 NXDOMAIN을 반환하는 것이 기대 결과다.
이 이름은 로그인 가능한 서비스 주소가 아니며, TLS/Entra 공통 주소가 구성됐다는 뜻이 아니다.
기존 cloudapp 주소의 A 레코드나 별도 DNS 영역의 CNAME을 변경하지 않았다.

## 생성·변경한 파일

- `infra/azure/dr-traffic-manager.validation.json`: 고정된 별도 프로필, 단일 비활성 참조 endpoint.
- `scripts/azure-dr-validation.py`: 기본은 로컬 검사; `--apply`로만 Azure 생성.
  승인 계정 확인 → 기존 구성/시작 화면 기록 → 전용 RG 생성 → ARM validate →
  what-if → 정확히 프로필 1개 Create만 허용 → Incremental 배포 → 상태 및 기존 구성 대조.
  기존 동명 프로필은 덮어쓰지 않고 중단한다.
  `--verify`는 마지막 배포 증거와 대조하는 읽기 전용 재확인이다.
- `test/azure_dr_validation_test.py`: 활성화·다른 target·추가 리소스·Modify/Delete 계획 거부 시험.
- 기존 `azure-dr-plan.py`, 후보 템플릿, 계획 시험은 보존했다. 활성 DR 후보와 이 검증 템플릿은 별개다.

```powershell
python scripts/azure-dr-validation.py
python -m unittest discover -s test -p 'azure_dr_*test.py' -v
python scripts/azure-dr-validation.py --verify
```

`--apply` 재실행은 이미 생성된 프로필을 자동 갱신하지 않는다.
새 standby 추가나 라우팅 활성화는 별도 검토된 변경이다.

## 보안·영향 검토

- VM·NIC·NSG·포트·PACS·DB·Key Vault·Entra 권한/redirect URI를 변경하지 않았다.
- Control/Data Plane 분리, 원본 분산 보관 및 환자 동의 정책을 변경하지 않았다.
- 프로필과 endpoint를 모두 비활성으로 생성하여 기존 서버에 주기적 probe도 보내지 않는다.
- 기존 서비스 점검은 인증정보·쿠키 없이 공개 시작 화면 GET과 구성 조회만 사용했다.
  기본 TLS 인증서·호스트 검증을 유지했고, 응답 본문은 보관하지 않고 SHA-256만 기록했다.
- 변경 전후 DNS IPv4, 공인 IP 설정, VM·NSG 구성 해시, Entra redirect 목록,
  웹 `/` 및 모바일 `/mobile/` 시작 화면의 상태·본문 해시가 같았다.
- 이 비교는 전체 환자/의료진 로그인·공유·CT 기능의 종단 회귀시험을 대신하지 않는다.
- 비활성화는 삭제 또는 무조건 무료라는 뜻이 아니다. 실제 청구와 학생 잔액은 미확인이다.
- 만료 태그는 2026-10-20 23:59 KST로 기록했으나 자동 삭제/종료 작업은 없다.
  새 VM은 없으므로 이번 작업에서 추가된 standby 컴퓨팅 가동은 없다.

## 실행 증거와 검증

로컬 증거 경로: `artifacts/azure/dr-validation-20261016T000932Z/`.
시각: 2026-10-16 오전 (KST). Azure 응답 시각은 증거 파일에서 UTC로 확인할 수 있다.
로그·증거는 로컬 보관하며, 일반 사용자 화면에 공개하지 않는다.

| 검사 | 결과 | 증거/한계 |
|---|---|---|
| 계획/승격 평가기 + 검증 템플릿 단위시험 | PASS | 25/25 |
| Azure ARM validate | PASS | arm-validation.json |
| what-if | PASS | what-if.json; 새 프로필 1개 Create만 존재 |
| 실제 배포·비활성 상태 | PASS | deployment.json, profile.json, result.json |
| 기존 구성/공개 시작 화면 동일 | PASS | before.json = after.json |
| 검증 DNS 비활성 응답 | PASS | post-verification.json; Windows DNS 클라이언트 9003/NXDOMAIN |
| Activity Log 관리 이벤트 | PASS | RG 및 Traffic Manager 프로필 write Succeeded 조회; post-verification.json |
| 타 리전 standby·DB 복제·승격 | NOT VERIFIED | 이번 범위에서 생성/실행하지 않음 |
| Priority 1→2 실제 전환·복구 시간·유실량 | NOT VERIFIED | 두 번째 endpoint 및 실제 장애시험 없음 |
| 공통 HTTPS/Entra, Key Vault 독립 복구 | NOT VERIFIED | 기존 미확정 사항 유지 |
| 자동 정리·최종 비용 | NOT VERIFIED | 태그는 스케줄이 아니며 청구 조회 미완료 |

Azure Activity Log 기본 관리 이벤트 조회와 Log Analytics 진단 내보내기·관제 UI 연동은 다르다.
이번 작업에서 새 진단 내보내기, 경보 또는 관제 UI 연결을 구성하지 않았다.

읽기 전용 재검증 완료 시각: 2026-10-16 09:12:58 KST.
`--verify`에서 프로필 Disabled, 기존 서비스 기준값 동일, NXDOMAIN,
프로필 생성 Activity Log까지 확인했다. 이는 실제 장애 전환 성공을 뜻하지 않는다.

## 다음 단계와 복구

지금은 사용자 트래픽과 분리됐으므로 앱 트래픽 rollback이 필요한 변경은 없다.
문제가 발견되면 프로필/endpoint Disabled 유지, 해당 RG만 조사한다.
전용 RG 삭제도 로그·증거 확인과 정확한 대상 재검토 후 별도 수행하며,
기존 서비스 RG나 Key Vault를 삭제 대상으로 삼지 않는다. 이번에 삭제한 자료는 없다.

다음 구현은 승인된 리전·키 접근 범위 확정 → 별도 standby 준비 → 안전한 DB 복제 →
승격 readiness endpoint → 검증 DNS에서 장애/차단 시험이다.
실제 사용자 주소 전환과 자동 DB 승격은 이번 승인 범위에 포함하지 않는다.

공식 동작 근거:
[Microsoft 엔드포인트/프로필 비활성 동작](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-monitoring),
[Traffic Manager ARM 속성](https://learn.microsoft.com/en-us/azure/templates/microsoft.network/2022-04-01/trafficmanagerprofiles).
