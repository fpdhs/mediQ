# 03 — Threads API

공식 문서: <https://developers.facebook.com/docs/threads>
베이스 URL: `https://graph.threads.net`

## 반드시 공식 API를 쓴다

리버스 엔지니어링 계열 라이브러리가 여럿 있다 (`Danie1/threads-api`,
`iSarabjitDhiman/MetaThreads` 등). **발행에는 쓰지 말 것.**

- 계정 정지 위험
- Meta가 내부 API를 바꾸면 그냥 깨진다 — 예고도 공지도 없다

공식 API는 무료이고 발행에 필요한 기능이 다 있다. 비공식 라이브러리를 쓸 이유가 없다.

## 제약 두 개

### 1. 24시간 250건

텍스트·이미지·캐러셀 모두 동일하게 카운트된다. 잔량 조회:

```
GET /{threads-user-id}/threads_publishing_limit
```

**이 숫자를 목표로 삼지 말 것.** 실질 제약은 API가 아니라 팔로워의 인내심이다.
하루 2~3건이 현실적인 목표고, 250건은 버그로 폭주할 때의 안전망 정도로 생각해야 한다.
발행 전에 이 엔드포인트를 확인하는 가드를 넣어두면 무한 루프 사고를 막을 수 있다.

### 2. 토큰 60일 만료

교환 흐름:

```
authorization code  →  short-lived token (1시간)  →  long-lived token (60일)
                                                        ↓
                                            발급 후 24시간~60일 사이에 갱신
```

갱신 가능 구간이 **발급 24시간 이후부터**라는 점에 주의. 발급 직후에는 갱신이 안 된다.

**갱신 로직이 없으면 두 달 뒤 파이프라인이 조용히 멈춘다.** 자동화가 죽는 가장 흔한
원인이고, 로그를 안 보면 알아차리기까지 며칠이 걸린다. 갱신 실패 시 본인에게 알림이
가도록 반드시 붙일 것.

## 참고 구현

| 저장소 | 볼 것 |
|---|---|
| [cjm7054/Threads-auto](https://github.com/cjm7054/Threads-auto) | 전체 구조 — 트렌드 수집 → LLM 생성 → 공식 API 발행. 이 프로젝트와 구성이 가장 가깝다 |
| [msloverdn10-creator/threads-auto-post](https://github.com/msloverdn10-creator/threads-auto-post) | 토큰 자동 갱신 구현 |
| [tirthpatell/threads-go](https://github.com/tirthpatell/threads-go) | Go 클라이언트 — OAuth 2.0 + 레이트리밋 처리 |

셋 다 개인 프로젝트이므로 코드 품질은 직접 확인해야 한다. 구조 참고용이다.

## 설정

`.env.example`을 복사해 `.env`로 쓴다. `.env`는 `.gitignore`에 있다.
**이 저장소는 공개이므로 토큰이 커밋되면 즉시 폐기하고 재발급해야 한다.**
