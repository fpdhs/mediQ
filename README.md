# mediQ

AI 트렌드 뉴스를 수집·선별해 Threads(Meta)에 발행하기 위한 조사 및 설계 저장소.

현재 상태: **조사 완료, 구현 전.** 코드는 소스 검증 스크립트 하나뿐이다.

## 이게 뭔가

매일 아침 "오늘 다룰 만한 AI 소식 상위 5건"이 점수와 함께 준비되어 있고,
그중 2~3건을 골라 손봐서 Threads에 올리는 워크플로를 만드는 게 목표다.

**완전 자동 발행은 명시적으로 목표가 아니다.** 이유는
[ADR-002](docs/04-decisions.md#adr-002-완전-자동-발행을-하지-않는다)에 적었다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/01-sources.md](docs/01-sources.md) | 검증된 수집 소스, 3계층 구조, 죽은 경로 목록 |
| [docs/02-architecture.md](docs/02-architecture.md) | 파이프라인 6단계, 중복 제거, 스코어링 공식 |
| [docs/03-threads-api.md](docs/03-threads-api.md) | Threads API 제약, 토큰 갱신, 비공식 라이브러리 경고 |
| [docs/04-decisions.md](docs/04-decisions.md) | 결정 기록(ADR) — 무엇을 왜 택하고 버렸는가 |

기계가 읽는 소스 정의는 [`sources.yaml`](sources.yaml)에 있다. 코드는 이 파일을
단일 진실 원천으로 삼는다.

## 소스 재검증

피드는 예고 없이 죽는다. `sources.yaml`의 모든 URL을 실제로 찔러보고 결과를 대조한다.

```bash
pip install -r requirements.txt
python scripts/check_feeds.py                  # 스코프 내 소스만
python scripts/check_feeds.py --all            # 스코프 외(보안) 포함
python scripts/check_feeds.py --report r.json  # 결과를 JSON 으로 저장
```

선언된 `status`와 실제 응답이 어긋나면 종료 코드 1을 반환한다. cron이나 CI에 걸어두면
소스가 썩는 걸 알아차릴 수 있다. 불일치가 나오면 `sources.yaml`을 손으로 갱신한다.

마지막 전수 검증: **2026-09-28** (`sources.yaml` 의 `meta.verified_at`)

## 핵심 발견 하나

`https://huggingface.co/api/daily_papers` — 인증 없이 논문 50건을 JSON으로 주고,
각 항목에 `upvotes`, `numComments`, `githubRepo`가 붙어 있다.

arXiv cs.LG는 하루 수백 건이 쏟아져 기계적 선별이 불가능한데, 이 엔드포인트는
사람이 이미 골라놓은 목록에 투표 수까지 얹어준다. **"무엇이 중요한가" 판단을
커뮤니티에 외주 주는 것**이 이 프로젝트의 핵심 전략이고, 파이프라인은 이 축을
중심으로 설계했다.

## 다음 작업

파이프라인 ①~③(수집 → 중복 제거 → 스코어링)만 먼저 구현한다. 발행도 초안 생성도
없이 매일 아침 마크다운 리포트만 뽑는다. 2주 돌려서 확인할 것:

1. 소스 중 실제로 쓸 만한 게 무엇인지
2. 스코어링 가중치가 맞는지
3. 본인이 이 주제로 꾸준히 쓸 수 있는지

셋 다 확인되기 전에 발행 파이프라인을 만들면 버려질 코드가 된다.

## 주의

이 저장소는 **공개**다. 토큰·앱 시크릿을 커밋하지 마라.
설정은 `.env.example`을 복사해 `.env`로 쓰고, `.env`는 `.gitignore`에 있다.
