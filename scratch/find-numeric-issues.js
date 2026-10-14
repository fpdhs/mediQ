import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';

const filePath = 'C:\\Users\\user\\Downloads\\medlineplus_ko_1017.jsonl';

async function scanIssues() {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  const holdIssues = [];
  const awkwardExpressions = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const doc = JSON.parse(line);

    for (const issue of doc.unresolved_issues ?? []) {
      holdIssues.push({
        docId: doc.doc_id,
        titleKo: doc.title_ko,
        titleEn: doc.title_en,
        issueType: issue.issue_type ?? '기타',
        reason: issue.reason,
        sourceExpression: issue.source_expression,
        aiQaStatus: doc.ai_qa_status
      });
    }

    // 환자가 답변을 받았을 때 이상하다고 느낄만한 번역투 세그먼트 탐색
    for (const seg of doc.segments ?? []) {
      const ko = seg.text_ko ?? '';
      const en = seg.text_en ?? '';

      // 1. "체온/열"과 단위 없는 숫자
      if (/[0-9]{2,3}(?:\s*도|\s*를\s*넘는|\s*이상의)?\s*(?:열|발열|체온)/u.test(ko) && !/°C|°F|섭씨|화씨/u.test(ko)) {
        if (/[89][0-9]|10[0-9]/u.test(ko)) {
          awkwardExpressions.push({
            type: '화씨 체온 단위 미표기',
            title: doc.title_ko,
            ko,
            en
          });
        }
      }

      // 2. 어색한 조사 및 직역투
      if (/의\s*의\s*|에\s*있어서의|에\s*의한\s*바와\s*같이/u.test(ko)) {
        awkwardExpressions.push({
          type: '이중/과도한 조사 직역',
          title: doc.title_ko,
          ko,
          en
        });
      }

      // 3. 부자연스러운 신체/증상 묘사
      if (/(?:당신의\s*몸|당신의\s*피|당신의\s*의사|당신의\s*건강)/u.test(ko)) {
        awkwardExpressions.push({
          type: '당신의 ~ 소유격 직역',
          title: doc.title_ko,
          ko,
          en
        });
      }

      // 4. 단독 문장으로 문맥 결여된 표현
      if (/^(?:그것은\s*다음과\s*같습니다|이들은\s*다음과\s*같습니다|다음은\s*몇\s*가지\s*예입니다)[.]?$/u.test(ko.trim())) {
        awkwardExpressions.push({
          type: '문맥 결여 목록 도입문',
          title: doc.title_ko,
          ko,
          en
        });
      }
    }
  }

  writeFileSync('scratch/all-issues-summary.json', JSON.stringify({
    totalHoldIssues: holdIssues.length,
    holdIssues,
    awkwardExpressions
  }, null, 2), 'utf8');

  console.log(`Scan completed. Found ${holdIssues.length} hold issues, ${awkwardExpressions.length} awkward expressions.`);
}

scanIssues().catch(console.error);
