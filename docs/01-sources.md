# 01 — 수집 소스

모든 URL은 **2026-09-28**에 실제 HTTP 요청으로 검증했다. 추측으로 적은 항목은 없다.
기계가 읽는 정의는 [`../sources.yaml`](../sources.yaml)이고, 이 문서는 그 판단 근거를 적는다.

재검증은 `python scripts/check_feeds.py`.

## 왜 3계층인가

소스를 한 바구니에 담으면 "arXiv 하루 수백 건"과 "OpenAI 공식 발표 1건"이 같은 무게를
갖게 된다. 역할이 다르므로 계층을 나눈다.

| 계층 | 역할 | 발행 소재로 쓰는가 |
|---|---|---|
| **Tier 1** | 화제 감지 — 무엇을 다룰지 고른다 | 선정 신호로만 |
| **Tier 2** | 1차 출처 — 사실을 확인한다 | 예 (링크 첨부 필수) |
| **Tier 3** | 해석 — 왜 중요한지 파악한다 | **아니오** (아래 참고) |

Tier 3을 발행 소재로 쓰지 않는 건 원칙 문제다. Simon Willison이나 Nathan Lambert의
관점을 요약해 올리면 그건 표절이다. 이 계층은 "이 주제가 왜 중요한지"를 이해하는
입력으로만 쓰고, 출력에는 본인 각도가 들어가야 한다.

## Tier 1 — 화제 감지

### Hugging Face Daily Papers (중심축)

```
GET https://huggingface.co/api/daily_papers
→ 200, JSON 배열 50건, 인증 불필요
```

항목 구조:

```
paper.id              arXiv ID — 원문 대조 및 중복 제거의 자연 키
paper.title
paper.summary
paper.upvotes         커뮤니티 큐레이션 신호
paper.githubRepo      존재하면 코드 공개됨 = 실용성 신호
numComments
submittedBy / organization / publishedAt
```

이 엔드포인트가 이 프로젝트를 성립시킨다. arXiv를 직접 긁으면 하루 수백 건 중 무엇이
중요한지 판단할 방법이 없는데, 여기는 사람이 골라놓은 목록에 투표 수가 붙어 있다.
`githubRepo` 필드는 "돌려볼 수 있는 논문"을 공짜로 걸러준다 —
[콘텐츠 앵글](02-architecture.md#발행-각도)에서 가장 차별화가 되는 "써봤다" 유형의 후보가 된다.

구 경로 `https://huggingface.co/papers/feed.xml`은 **401**로 죽었다. 다시 시도하지 말 것.

### Hacker News

```
https://hnrss.org/newest?q=AI&points=100
```

`q`와 `points`가 URL 파라미터라 노이즈를 직접 조절할 수 있다. `points=100`은 시작값이고
2주 정도 돌려보며 조정할 대상이다.

### GeekNews

```
https://news.hada.io/rss/news        (미러: https://feeds.feedburner.com/geeknews-feed)
```

**Atom 포맷(`<entry>`)이다.** RSS(`<item>`) 파서로 읽으면 0건이 나온다. 파서 분기 필요.
국내 개발자 사이에서 무엇이 반응을 얻는지 보는 용도.

## Tier 2 — 1차 출처

| 소스 | URL |
|---|---|
| OpenAI News | `https://openai.com/news/rss.xml` |
| Google DeepMind Blog | `https://deepmind.google/blog/rss.xml` |
| Hugging Face Blog | `https://huggingface.co/blog/feed.xml` |
| Google AI Blog | `https://blog.google/technology/ai/rss/` |
| arXiv cs.AI | `https://rss.arxiv.org/rss/cs.AI` |
| arXiv cs.LG | `https://rss.arxiv.org/rss/cs.LG` |
| MIT Technology Review AI | `https://www.technologyreview.com/topic/artificial-intelligence/feed` |
| TechCrunch AI | `https://techcrunch.com/category/artificial-intelligence/feed/` |

**DeepMind 피드는 gzip으로 응답한다.** Accept-Encoding 협상 없이 받으면 깨진 바이너리가
나온다. 조사 중 실제로 이걸 밟았다 — `curl`은 `--compressed`, Python `requests`는 기본 처리된다.

**arXiv cs.LG는 단독으로 쓰지 않는다.** 하루 수백 건이라 필터링이 불가능하다.
Tier 1에서 고른 논문의 원문을 `paper.id`로 대조하는 용도다.

### Anthropic은 RSS가 없다

```
https://www.anthropic.com/rss.xml       → 404
https://news.anthropic.com/rss.xml      → 응답 없음
```

주요 랩 중 유일하게 피드가 없다. 뉴스룸 HTML 스크래핑을 따로 붙여야 한다.
Mistral(`/news/feed.xml`)도 404다.

## Tier 3 — 해석

| 소스 | URL |
|---|---|
| Simon Willison's Weblog | `https://simonwillison.net/atom/everything/` (Atom) |
| Interconnects (Nathan Lambert) | `https://www.interconnects.ai/feed` |
| Latent Space | `https://www.latent.space/feed` |
| Ahead of AI (Sebastian Raschka) | `https://magazine.sebastianraschka.com/feed` |
| SemiAnalysis | `https://semianalysis.com/feed/` |
| Import AI (Jack Clark) | `https://importai.substack.com/feed` |
| Don't Worry About the Vase (Zvi) | `https://thezvi.substack.com/feed` |
| Lil'Log (Lilian Weng) | `https://lilianweng.github.io/index.xml` |

SemiAnalysis는 반도체·인프라 관점이라 다른 소스와 겹치지 않는 각도를 준다.

deeplearning.ai The Batch(`/the-batch/feed/`)는 **404**다. 본문은 이메일 전용이므로
필요하면 메일 파싱을 따로 붙여야 한다.

## 국내

| 소스 | URL |
|---|---|
| AI타임스 | `https://www.aitimes.com/rss/allArticle.xml` |
| AI타임스kr | `https://www.aitimes.kr/rss/allArticle.xml` |
| ITWorld Korea | `https://www.itworld.co.kr/feed/` |
| 바이라인네트워크 | `https://byline.network/feed/` (UA 민감, 아래 참고) |

`aitimes.com`과 `aitimes.kr`은 **서로 다른 매체**다. 둘 다 구독해도 중복이 심하지 않다.

## 죽은 경로 / 차단된 소스

재시도로 시간을 낭비하지 않도록 실패 결과를 남긴다.

| URL | 코드 |
|---|---|
| `https://www.anthropic.com/rss.xml` | 404 |
| `https://news.anthropic.com/rss.xml` | 응답 없음 |
| `https://mistral.ai/news/feed.xml` | 404 |
| `https://www.deeplearning.ai/the-batch/feed/` | 404 |
| `https://huggingface.co/papers/feed.xml` | 401 (폐기) |
| `https://ai.meta.com/blog/rss/` | 404 |
| `https://www.zdnet.co.kr/Include/RSS/zdnetkorea_news.xml` | 404 |

봇 차단:

| URL | 코드 | 비고 |
|---|---|---|
| `https://venturebeat.com/category/ai/feed/` | 429 | UA를 바꿔도 유지된다. 의존 불가 |

### User-Agent 위장이 오히려 차단을 부른다

조사 중 `Mozilla/5.0`으로 요청했을 때 SecurityWeek과 바이라인네트워크가 403을 반환했다.
`check_feeds.py`를 만들어 설명적인 UA로 다시 요청하니 **둘 다 200이 나왔다.**

```
User-Agent: Mozilla/5.0                                        → 403
User-Agent: mediq-feed-checker/0.1 (+https://github.com/...)   → 200
```

Cloudflare 계열 보호는 브라우저를 어설프게 위장한 UA를 더 의심한다. 정체와 연락처를
밝히는 UA가 통과율이 높다. 두 소스는 각각 국내(바이라인)와 스코프 외 보안(SecurityWeek)으로
편입했다.

이건 검증 방법론의 교훈이기도 하다 — 피드가 죽었다는 판정은 UA를 바꿔 한 번 더 확인한 뒤에
내려야 한다.

## 스코프 외 — 보안 뉴스 (검증 결과 보존)

초기 조사에서 보안 뉴스도 함께 검증했다가 스코프를 AI 트렌드로 좁혔다
([ADR-001](04-decisions.md#adr-001-스코프를-ai-트렌드로-좁힌다)).
되살릴 때 재조사하지 않도록 결과만 남긴다. 전부 200 확인.

| 소스 | URL |
|---|---|
| 보안뉴스 전체기사 | `https://cdn.boannews.com/rss/gn_rss_allArticle.xml` |
| 데일리시큐 전체기사 | `https://cdn.dailysecu.com/rss/gn_rss_allArticle.xml` |
| KISA 보안공지 | `https://www.boho.or.kr/kr/rss.do?bbsId=B0000133` |
| KISA 취약점 정보 | `https://www.boho.or.kr/kr/rss.do?bbsId=B0000302` |
| KISA 사이버위기 경보단계 | `https://www.boho.or.kr/kr/rss.do?bbsId=B0000342` |
| KISA 공지사항 | `https://www.boho.or.kr/kr/rss.do?bbsId=B0000132` |
| KISA 보고서/가이드 | `https://www.boho.or.kr/kr/rss.do?bbsId=B0000127` |
| CISA KEV (JSON) | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` |
| CISA Advisories | `https://www.cisa.gov/cybersecurity-advisories/all.xml` |
| The Hacker News | `https://thehackernews.com/feeds/posts/default` |
| BleepingComputer | `https://www.bleepingcomputer.com/feed/` |
| Krebs on Security | `https://krebsonsecurity.com/feed/` |
| Dark Reading | `https://www.darkreading.com/rss.xml` |
| arXiv cs.CR | `https://rss.arxiv.org/rss/cs.CR` |
| SecurityWeek | `https://www.securityweek.com/feed/` (UA 민감) |

보안 라인을 되살릴 때 알아야 할 두 가지:

**CISA KEV가 최우선 소스다.** 2026-09-28 확인 시 `catalogVersion` 2026.09.27,
`count` 1728. "실제 공격에 쓰이는 중"이라는 필터가 이미 걸려 있어 신호 대비 노이즈가
압도적으로 낮다. `catalogVersion` / `dateReleased`로 델타를 감지한다.

**보안뉴스·데일리시큐 피드에는 기사 본문 전문이 들어 있다.** `content:encoded`에 본문과
이미지가 그대로 담긴 Google News 전송용 피드다(`gn_rss`). 기술적으로 전재가 가능한 것과
해도 되는 것은 다르다. 요약 + 출처 명기 + 원문 링크를 벗어나지 말 것.
KISA 경보단계 피드는 갱신이 드문 대신 변경 자체가 이슈라, 보안 라인에서 자동화 ROI가
가장 높았던 소스다.

## 또 하나의 발견 — 국내 피드 경로 규칙

국내 언론사 다수가 같은 CMS를 쓴다. 흔히 인용되는 `/rss/allArticle.xml`은 매체에 따라
404이고, 실제 경로는 CDN 쪽이다.

```
https://www.boannews.com/media/news_rss.xml      → 404
https://www.dailysecu.com/rss/allArticle.xml     → 404
https://cdn.boannews.com/rss/gn_rss_allArticle.xml   → 200
https://cdn.dailysecu.com/rss/gn_rss_allArticle.xml  → 200
```

새 국내 매체를 추가할 때는 `cdn.<도메인>/rss/gn_rss_allArticle.xml`을 먼저 시도하고,
안 되면 해당 매체의 RSS 안내 페이지 HTML에서 `href`를 직접 추출하는 게 빠르다.
(`aitimes.com`은 반대로 `www` + `/rss/allArticle.xml`이 동작한다 — 규칙이 균일하지 않으므로
반드시 검증할 것.)
