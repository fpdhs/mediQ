import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';

const filePath = 'C:\\Users\\user\\Downloads\\medlineplus_ko_1017.jsonl';

async function deepAnalyze() {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  const holdReasons = [];
  const findingsSummary = {};
  const awkwardPatterns = {
    haveDisease: { regex: /(?:질환|질병|증상|문제|암|당뇨|고혈압|감염)(?:을|를)\s*가지고\s*(?:있|계신)/u, label: '질환/증상을 가지고 있다 (have disease 직역)' },
    experienceSymptoms: { regex: /(?:증상|통증|불편|어려움)(?:을|를)\s*경험하/u, label: '증상을 경험하다 (experience symptoms 직역)' },
    talkToDoctor: { regex: /(?:의료진과|의사와|주치의와)\s*이야기하(?:세요|십시오|며)/u, label: '의사와 이야기하세요 (talk to doctor 직역)' },
    itIsImportant: { regex: /(?:중요합니다|중요해요)\s*(?:의료진|검사|치료)/u, label: 'It is important that 직역형' },
    helpToOveruse: { regex: /(?:도움이\s*됩니다|도움을\s*줍니다|도울\s*수\s*있습니다)/u, label: '도움을 준다/도움이 된다 (help to) 빈도' },
    mayIncludeOveruse: { regex: /(?:포함될\s*수\s*있습니다|포함할\s*수\s*있습니다|포함됩니다)/u, label: '포함될 수 있습니다 (may include) 빈도' },
    ifYouHave: { regex: /(?:만약\s*(?:당신이|환자가)?|만약에)/u, label: '만약 (if 직역) 표현' },
    orderTest: { regex: /(?:검사를\s*주문|테스트를\s*주문)/u, label: '검사를 주문하다 (order a test 오역)' },
    seeDoctor: { regex: /(?:의사를\s*보세요|의사를\s*만나세요)/u, label: '의사를 보세요 (see a doctor 직역)' },
    certainPeople: { regex: /(?:어떤\s*사람들은|특정\s*사람들은|일부\s*사람들은)/u, label: '일부/어떤 사람들 (certain people/some people 직역)' },
    makeSure: { regex: /(?:확실히\s*하세요|확인하십시오)/u, label: '확실히 하세요 (make sure 직역)' },
    takeMedicine: { regex: /(?:약을\s*취하|약을\s*가져가)/u, label: '약을 취하다 (take medicine 오역)' },
    leadTo: { regex: /(?:~로\s*이어질\s*수\s*있|로\s*이끌\s*수\s*있)/u, label: '이끌 수 있다 (lead to 직역)' },
  };

  const awkwardCounts = {};
  for (const k of Object.keys(awkwardPatterns)) awkwardCounts[k] = { count: 0, samples: [] };

  let docIndex = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    docIndex++;
    const doc = JSON.parse(line);

    if (doc.ai_qa_status === 'HOLD') {
      holdReasons.push({
        id: doc.doc_id,
        titleKo: doc.title_ko,
        titleEn: doc.title_en,
        unresolvedIssues: doc.unresolved_issues,
        automaticFindings: doc.automatic_findings,
      });
    }

    for (const f of doc.automatic_findings ?? []) {
      const key = typeof f === 'string' ? f : f.type || f.code || JSON.stringify(f);
      findingsSummary[key] = (findingsSummary[key] ?? 0) + 1;
    }

    for (const seg of doc.segments ?? []) {
      const ko = seg.text_ko ?? '';
      const en = seg.text_en ?? '';
      for (const [k, p] of Object.entries(awkwardPatterns)) {
        if (p.regex.test(ko)) {
          awkwardCounts[k].count++;
          if (awkwardCounts[k].samples.length < 5) {
            awkwardCounts[k].samples.push({
              docId: doc.doc_id,
              titleKo: doc.title_ko,
              ko,
              en
            });
          }
        }
      }
    }
  }

  const output = {
    totalDocs: docIndex,
    totalHolds: holdReasons.length,
    holdReasonsSample: holdReasons.slice(0, 15),
    findingsSummary,
    awkwardCounts: Object.fromEntries(Object.entries(awkwardCounts).map(([k, v]) => [k, { label: awkwardPatterns[k].label, count: v.count, samples: v.samples }]))
  };

  writeFileSync('scratch/deep-analysis.json', JSON.stringify(output, null, 2), 'utf8');
  console.log('Deep analysis complete, written to scratch/deep-analysis.json');
}

deepAnalyze().catch(console.error);
