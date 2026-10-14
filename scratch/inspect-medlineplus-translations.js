import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';

const filePath = 'C:\\Users\\user\\Downloads\\medlineplus_ko_1017.jsonl';

const patterns = {
  directPronounYou: { regex: /(?:^|\s)(?:당신|당신의|당신은|당신이|당신에게|당신을)(?:\s|[.,!?]|$)/gu, label: '당신(You) 2인칭 직역' },
  directPronounIt: { regex: /(?:^|\s)(?:그것은|그것이|그것을|그것의|그것에)(?:\s|[.,!?]|$)/gu, label: '그것(It) 대명사 직역' },
  providerLiteral: { regex: /(?:건강\s*관리\s*제공자|의료\s*제공자|헬스케어\s*제공자|보건의료\s*제공자)/gu, label: '제공자(health care provider) 직역' },
  callDoctorLiteral: { regex: /(?:의사에게\s*전화|의사에게\s*전화하|주치의에게\s*전화|병원에\s*전화)/gu, label: '전화하세요(call your doctor) 직역' },
  runTestLiteral: { regex: /(?:검사를\s*실행|테스트를\s*실행|시험을\s*실행|검사를\s*수행하다|테스트를\s*돌리)/gu, label: '검사 실행(perform/run a test) 어색한 표현' },
  conditionLiteral: { regex: /(?:의학적\s*조건|건강\s*조건|신체적\s*조건)/gu, label: '조건(condition=질환) 오역/직역' },
  positiveNegativeLiteral: { regex: /(?:긍정적인\s*결과|부정적인\s*결과)/gu, label: '양성/음성 대신 긍정적/부정적 결과 오역' },
  drugLiteral: { regex: /(?:처방전\s*마약|의학적\s*마약|치료용\s*마약)/gu, label: 'drug를 마약으로 오역' },
  clickLinkLiteral: { regex: /(?:아래\s*링크|여기를\s*클릭|페이지를\s*참조|웹사이트를\s*방문)/gu, label: '링크/웹페이지 참조 잔재' },
  listLeadFragment: { regex: /(?:다음과\s*같습니다|다음은\s*.*입니다|아래와\s*같습니다|다음\s*목록|아래\s*목록)/gu, label: '단독 발췌 시 무의미한 목록 도입문' },
  htmlEntities: { regex: /(?:&amp;|&quot;|&lt;|&gt;|&#\d+;|<[^>]+>)/gu, label: 'HTML 태그/엔티티 잔재' },
  passiveLiteral: { regex: /(?:~에\s*의해\s*(?:보여|수행|결정|사용|진단)되|에\s*의하여)/gu, label: '영어식 피동/수동태 직역' },
  plainStyleEndings: { regex: /[가-힣]+(?:한다|이다|된다|있다|없다|받는다|생긴다)\.\s*$/u, label: '평어체(~한다/이다) 종결' },
  politeStyleEndings: { regex: /[가-힣]+(?:합니다|습니다|입니다|됩니다|있습니다|없습니다|받습니다)\.\s*$/u, label: '존댓말(~합니다) 종결' },
  imperativePolite: { regex: /[가-힣]+(?:하세요|해\s*주세요|받으세요|말하세요|알리세요)\.\s*$/u, label: '권고/청유형(~하세요) 종결' }
};

async function inspect() {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let totalDocs = 0;
  let totalSegments = 0;
  const counts = {};
  for (const key of Object.keys(patterns)) counts[key] = { count: 0, examples: [] };
  const unresolvedIssueTypes = {};
  let totalHolds = 0;
  let totalPasses = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalDocs++;
    const doc = JSON.parse(line);
    if (doc.ai_qa_status === 'HOLD') totalHolds++;
    if (doc.ai_qa_status === 'PASS') totalPasses++;

    for (const issue of doc.unresolved_issues ?? []) {
      unresolvedIssueTypes[issue] = (unresolvedIssueTypes[issue] ?? 0) + 1;
    }

    const segments = doc.segments ?? [];
    for (const seg of segments) {
      totalSegments++;
      const textKo = seg.text_ko ?? '';
      const textEn = seg.text_en ?? '';

      for (const [key, pat] of Object.entries(patterns)) {
        if (pat.regex.test(textKo)) {
          counts[key].count++;
          if (counts[key].examples.length < 5) {
            counts[key].examples.push({
              docId: doc.doc_id,
              titleKo: doc.title_ko,
              titleEn: doc.title_en,
              textKo,
              textEn,
              match: textKo.match(pat.regex)?.[0]
            });
          }
        }
      }
    }
  }

  const result = {
    totalDocs,
    totalHolds,
    totalPasses,
    totalSegments,
    counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { label: patterns[k].label, count: v.count, exampleCount: v.examples.length, examples: v.examples }])),
    unresolvedIssueTypes
  };
  const {writeFileSync} = await import('node:fs');
  writeFileSync('scratch/inspection-results.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('Saved inspection-results.json');
}

inspect().catch(err => { console.error(err); process.exit(1); });
