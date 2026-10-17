# 공유 Vault purge protection 활성화

상태: **지정한 설정 변경 PASS / DRAFT · UNASSIGNED**. 사용자 명시 승인: 공유 Vault `kv-hp-demo-4869edd9`에 현재7일 기준 purge protection 활성화. 관측 2026-10-13 10:57–10:58 Asia/Seoul. 실제 실행 HEAD `150adeb4f64acd8075de2eea51fe8105882f6f1e` + dirty. 병행 의료진 UI 작업과 기존 변경은 보존했고 이번 작업에서 commit/push 하지 않았다.

## 적용 결과

정확한 subscription/tenant/Vault/region과 private/RBAC/soft-delete7일 기준선을 확인한 후, ARM API2024-11-01에 다음 **한 항목만 PATCH**했다.

```json
{"properties":{"enablePurgeProtection":true}}
```

독립 GET 결과 `enablePurgeProtection=true`. 나머지 Vault properties(해당 값과 provisioningState 제외), tags, location과 기존 Vault/key scope role assignments 전부 변경 전후 동일하다. 보존 기간7일, publicNetworkAccess Disabled, enableRbacAuthorization true, enableSoftDelete true 유지. A/B service identity에 추가 권한을 부여하지 않았다. 새 키 생성·삭제·disable·rotation, VM 재부팅, 데이터 포맷, PACS/웹 배포는 수행하지 않았다.

이 설정은 Vault 전체와 그 객체에 적용되며 비가역적이다. `false` rollback이나 Vault 삭제로 되돌리는 방법을 제공하지 않는다. 원문의 [Microsoft Vault PATCH 계약](https://learn.microsoft.com/en-us/rest/api/keyvault/keyvault/vaults/update?view=rest-keyvault-keyvault-2024-11-01)을 확인하고 최소 PATCH를 사용했다. 기존7일 보존 기간은 변경하지 않았다.

## 요구사항·파일·검증

관련 V3-SR-CRY-005, V3-SR-OPS-003, V3-SR-AUD-001/003(잔여 감사 검증). 전 범위 요구사항 PASS는 아니다. `azure-compliance` 스킬의 점검/변경 분리 원칙에 따라 configuration readback을 복구/crypto 검증과 구분했다.

생성: `scripts/b-pacs-enable-purge-protection.py`, `test/b_pacs_purge_protection_test.py`, 이 실행 기록. 수정: 현재 상태와 이전 검토 문서에 최신 실행 결과 링크. 신규 production API/DB/UI 변경 없음.

| 검증 | 결과 | 증적 |
|---|---|---|
| 정확한 계정·Vault·private/RBAC/soft-delete7일 baseline | PASS | 실제 적용 전 readback |
| purge protection 활성화 | PASS | 실제 PATCH 후 독립 GET=true |
| 다른 Vault properties·tags·region 보존 | PASS | 전후 구조 비교 |
| 기존 Vault/key scope role assignments 보존 | PASS | 전후 실제 목록 비교 |
| 관리 write Activity Log event | NOT VERIFIED | 즉시 조회 결과 Succeeded event 미확인; 구성 GET 성공과 구분 |
| Key Vault crypto AuditEvent 진단 수집 | 미구성 문제 유지 | 이번에 수집처·설정 변경하지 않음; 복구 검토에서 발견한 FAIL을 PASS로 승격하지 않음 |
| baseline guard·다른 대상/retention/network 거부·최소 PATCH 테스트 | PASS 6/6 | unittest, exit0 |
| 재부팅 복구·별도 Vault restore·볼륨 DR·B PACS·700장 | NOT VERIFIED | 실행하지 않음 |

실제 명령: `python scripts/b-pacs-enable-purge-protection.py --apply`, exit0, 42,562ms.
증적: `artifacts/azure/b-purge-protection-20261013T015714Z/result.json`.
테스트: `python -m unittest discover -s test -p b_pacs_purge_protection_test.py -v`, exit0,6/6. 최초 문서 읽기 명령의 TotalCount 입력 오류는 재읽기로 수정했으며 Azure 변경 전이었다.

## 재확인과 안전 처리

`python scripts/b-pacs-enable-purge-protection.py`는 기본 read-only로 baseline/readback을 확인한다. `--apply`는 명시적 변경 실행 모드이며 이미 활성화되었으면 PATCH를 반복하지 않는다. 다른 retention/region/account/network/RBAC가 발견되면 중단한다. timeout/응답 미확인 시 GET으로 실제 적용 상태부터 확인하며 false 전환·삭제·자동 rollback을 시도하지 않는다.

원시 secret/key/token을 읽거나 저장하지 않고 관리자 Azure CLI 로그인으로 ARM을 사용한다. 새 권한·secret·public network bypass를 만들지 않았다. 여기서 properties/role 보존 PASS는 실제 영상 wrap/unwrap 및 환자 브라우저 회귀 PASS가 아니다.

## 남은 작업

다음 작업 한 개: **Key Vault AuditEvent의 수집처·보존 기간·조회 권한을 정하고 감사 수집을 연결하는 준비**. 기존 승인된 수집처를 우선 조사하고 신규 비용/리소스가 필요하면 별도 승인받는다. 이후 실제 암호 연산 event와 운영자/key version/time을 확인해야 한다. 재부팅·복원·PACS·700장 흐름의 이전 미검증 상태는 유지한다. 전체 MVP/v3 완료를 선언하지 않는다.
