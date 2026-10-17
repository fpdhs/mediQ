# 개발 환경 실행 안내

이 문서는 로컬 개발용이다. 공개 시연 접속은 [프로젝트 소개](https://sureasdufo1-hue.github.io/Highpass-Project/)의 Azure 링크를 사용한다.

Node.js 20 이상 및 package.json에 지정된 pnpm을 사용한다. 기존 스택과 실행 옵션은
[릴리즈·복구 문서](operations/release-runbook.md), [아키텍처](ARCHITECTURE.md),
[환경변수 예시](../.env.example)를 확인한다. 예시 인증을 실제 배포 인증으로 대체하지 않는다.

```sh
pnpm install --frozen-lockfile
pnpm start:local
```

정적 포트폴리오만 로컬 미리보기:

```sh
python -m http.server 8768 --bind 127.0.0.1 --directory docs
```

위 정적 서버는 Control API나 병원 Gateway를 실행하지 않는다. 로컬 화면을 확인한 것을
Azure 배포·실제 환자 인증·영상 조회 검증으로 해석하지 않는다.
