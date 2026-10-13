# 웹 시안 보관소

정리 기준일: 2026-10-13

아래 파일은 당시 화면 검토와 개발 참고를 위해 만든 독립 시안입니다. 현재 환자·의료진 웹이나 모바일 PWA의 실행 화면으로 간주하지 않습니다. 원본 파일은 이력과 디자인 참고를 위해 보존하며 `public/`에서 옮겨 서버 정적 경로나 애플리케이션 Docker 이미지로 제공되지 않도록 했습니다.

| 시안 | 마지막 코드 변경 | 상태 |
|---|---|---|
| `index.html`, `patient-portal.html`, `saas-console.html` | 2026-10-07 | 이전 통합 목업. 일부 디자인 계보는 현재 `public/index.html`에 반영됨. |
| `highpass-refresh/` | 2026-10-09 | 별도 화면 제안. 서비스 API와 연결되지 않은 디자인 시안이며 로컬 전용 미리보기 스크립트가 사용함. |
| `mobile-flow/` | 2026-10-10 | 로그인·공유·QR의 인터랙션 목업. `public/mobile/`의 실행 가능한 PWA와 다름. |
| `mediq-legacy/` | 2026-10-07 | 이전 MediQ 환자·SaaS 화면 목업. 설계 문서에서 비규범 참고자료로만 인용함. |

## 현재 화면 기준

- 환자·의료진 웹: `public/index.html`, `public/app.js`, `public/styles.css`
- 환자 모바일 PWA: `public/mobile/index.html`, `public/mobile/app.js`, `public/mobile/style.css`
- 구현·배포 상태: 저장소 루트 README의 발표 환경 통합 상태 문서 링크에서 최신 절 확인

시안 날짜가 더 최근이라는 이유만으로 현재 화면이나 승인된 제품 요구사항을 대체하지 않습니다. 시안은 기능·보안·API 동작의 증거가 아닙니다.
