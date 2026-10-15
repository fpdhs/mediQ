# 건강도우미 MedlinePlus 출처 이용 범위 점검

작성일: 2026-10-13
상태: **공식 정책 범위 대조 메모 · 법률·제품 승인 아님**

## 결론

현재 교차검사 locator의 16개 후보는 **14개 고유 MedlinePlus `/lab-tests/` 페이지**를 참조한다. NLM의 현행 이용정책은 MedlinePlus의 공공영역 콘텐츠 범주에 `Medical test information`을 포함하고, 비저작권 콘텐츠는 재생산·재배포·링크할 수 있다고 안내하며 출처 표시 문구도 제시한다. 따라서 이번 후보 묶음은 권리 검토의 출발점으로 **`PUBLIC_DOMAIN_POLICY_SCOPE_MATCH — PROJECT REVIEW PENDING`**라고 기록하는 것이 합리적이다.

이 결과는 후보를 서비스에 투입할 권한이나 법률 의견이 아니다. MedlinePlus는 사이트 내 다른 자료 일부가 별도 저작권 대상이라고 구분하며, 저작권 자료의 EHR·환자포털·기타 건강 IT 시스템 내 수집/브랜딩은 별도 라이선스가 필요하다고 안내한다. 따라서 본 프로젝트는 **`CLEARED_FOR_SERVICE`로 승격하지 않는다.**

## 확인 범위와 근거

기준 문서: [NLM/MedlinePlus — Linking to and Using Content from MedlinePlus](https://medlineplus.gov/about/using/usingcontent/) (정책 페이지 표시 최종 갱신일: 2022-10-26, 현재 확인: 2026-10-13). 해당 문서는 영어·스페인어 자료에서 공개 콘텐츠와 별도 저작권 콘텐츠를 분리한다. 공공영역 범주에 건강 주제 페이지 요약과 의료검사 정보 등을 들고, 출처로 `Source: MedlinePlus, National Library of Medicine.`를 표시할 수 있다고 설명한다.

이번 범위의 로컬 근거는 [문장별 locator v4](./health-helper-cross-test-source-locators-2026-10-13-v4.json) 및 후보 스냅샷 manifest에 고정되어 있다. v4는 기존 URL·후보 범위를 바꾸지 않고 원문 페이지 갱신일과 제목 구간 안의 문단 locator를 보강한다. 문단 연결은 전부 검토 후보 위치이며 의미상 지지·권리·임상 승인을 뜻하지 않는다.

| 후보 묶음 | 확인 결과 |
|---|---|
| 교차검사 후보 | 16개 후보, 14개 고유 URL; 모두 `https://medlineplus.gov/lab-tests/` 아래 |
| 정책 페이지 URL | `https://medlineplus.gov/about/using/usingcontent/` |
| 정책 페이지 로컬 스냅샷 SHA-256 | `sha256:395448c1bd29d61919a77a0481aa4ae7775a22bd42fb921d3d5303c332befb85` |
| 동일 정책 스냅샷이 포함된 manifest | AFP v2, scenario 20261012, liver v4, screening v3 |
| 검색 후보가 사용한 출처 표기 | `Source: MedlinePlus, National Library of Medicine.` |

지원되는 좁은 해석은 “후보가 참조하는 영어 `/lab-tests/` 의료검사 정보 본문에 대해 NLM이 공개한 공공영역 정책 근거를 찾았다”는 것이다. 전체 HTML 스냅샷, 로고·사진·삽화, 연결된 제3자 문서, 다른 MedlinePlus 콘텐츠, 번역의 공식성 또는 환자포털 제품 내 이용은 이 판단에 자동 포함되지 않는다.

## 제품 적용 전 확인 사항

1. 각 후보의 정확한 섹션이 실제 `Medical test information` 본문인지, 이미지·외부 자료·타 콘텐츠가 요약에 섞이지 않았는지 출처 검토자가 확인한다.
2. 한국어 문장은 프로젝트 작성 초안이며 공식 번역이 아니다. 번역 검토와 임상 검토를 각각 독립적으로 수행한다.
3. 출처를 표시하되 NLM/MedlinePlus의 후원·인증·보증을 암시하지 않는다. 원문 페이지를 iframe/frame으로 감싸거나 다른 도메인의 자료처럼 보이게 하지 않는다.
4. 웹·모바일 서비스에 실제 표시하기 전 제품/보안 책임자가 저장·검색·인용·번역·화면표시의 정확한 사용방식과 보존정책을 승인한다. 검토 전에는 현재 후보 상태를 유지한다.
5. 저작권이 있는 MedlinePlus 콘텐츠를 추가할 경우 이 메모의 판단을 적용하지 않는다. 해당 콘텐츠는 권리자 직접 허가/라이선스 검토 또는 단일 직접 링크 방식으로 별도 처리한다.

## 상태 변경 금지

이번 점검은 권리 근거 URL·정책 문구·후보 source URL 범위를 대조했을 뿐, 법률 검토자나 제품 책임자의 승인 기록을 만들지 않았다. 따라서 모든 관련 후보는 계속 `DRAFT / UNASSIGNED`, `serviceEligible=false`, `clinicalUse=false`다. 환자용 서비스에서 의료 설명 RAG를 활성화하거나, 기존 source inventory의 적격 건수에 합산하지 않는다.

## 다음 조치

PM은 이 범위 메모와 locator JSON을 기준으로 출처 재사용/제품 적용 검토자를 지정한다. 별도로 적격 의료 검토자가 30개 후보 문장의 원문 충실도와 임상 범위를 확인해야 한다. 승인 전까지 유지할 수 있는 범위는 격리된 합성 후보 검색·평가·검토 지원뿐이다.
