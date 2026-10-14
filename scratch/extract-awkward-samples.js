import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';

const filePath = 'C:\\Users\\user\\Downloads\\medlineplus_ko_1017.jsonl';

async function extractSamples() {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  const categories = {
    temperatureUnit: { title: '체온 단위(화씨 100도 이상 등) 표기 문제', items: [] },
    listLeads: { title: '단독 발췌 시 무의미한 목록 도입문 (다음과 같습니다 등)', items: [] },
    pronounYou: { title: '2인칭 대명사 당신/당신의 직역', items: [] },
    pronounIt: { title: '3인칭 대명사 그것은/이것은 직역', items: [] },
    talkToDoctor: { title: 'talk to doctor -> 의사와 이야기하세요 직역', items: [] },
    repetitiveMayInclude: { title: 'may include -> 포함될 수 있습니다 기계적 반복', items: [] },
    providerLiteral: { title: 'health care provider -> 건강관리 제공자/의료 제공자 직역', items: [] },
    haveDisease: { title: 'have disease -> 질환을 가지고 있다 직역', items: [] },
    awkwardTerminology: { title: '기타 어색한 어휘/표현', items: [] }
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const doc = JSON.parse(line);
    const docTitle = `${doc.title_ko} (${doc.title_en})`;

    for (const seg of doc.segments ?? []) {
      const ko = seg.text_ko ?? '';
      const en = seg.text_en ?? '';

      // 1. 체온 단위
      if (/(?:10[0-9]|9[8-9])\s*도|(?:10[0-9]|9[8-9])\s*(?:이상|초과|열|고열)/u.test(ko) && !/섭씨|°C|화씨|°F/u.test(ko)) {
        if (categories.temperatureUnit.items.length < 8) {
          categories.temperatureUnit.items.push({ docTitle, ko, en });
        }
      }

      // 2. 목록 도입문
      if (/^(?:다음과\s*같습니다|다음은\s*.*입니다|아래와\s*같습니다)[.!]?$/u.test(ko.trim()) || /(?:다음과\s*같습니다|다음은\s*다음과|아래와\s*같습니다)/u.test(ko)) {
        if (categories.listLeads.items.length < 8) {
          categories.listLeads.items.push({ docTitle, ko, en });
        }
      }

      // 3. 당신
      if (/(?:당신|당신의|당신은|당신이|당신에게)/u.test(ko)) {
        if (categories.pronounYou.items.length < 8) {
          categories.pronounYou.items.push({ docTitle, ko, en });
        }
      }

      // 4. 그것은
      if (/(?:그것은|그것이|그것을|그것의)/u.test(ko)) {
        if (categories.pronounIt.items.length < 8) {
          categories.pronounIt.items.push({ docTitle, ko, en });
        }
      }

      // 5. 의사와 이야기하세요
      if (/(?:의사와\s*이야기|의료진과\s*이야기|주치의와\s*이야기)/u.test(ko)) {
        if (categories.talkToDoctor.items.length < 8) {
          categories.talkToDoctor.items.push({ docTitle, ko, en });
        }
      }

      // 6. 포함될 수 있습니다
      if (/포함될\s*수\s*있습니다/u.test(ko) && categories.repetitiveMayInclude.items.length < 8) {
        categories.repetitiveMayInclude.items.push({ docTitle, ko, en });
      }

      // 7. 제공자
      if (/(?:건강\s*관리\s*제공자|의료\s*제공자)/u.test(ko) && categories.providerLiteral.items.length < 8) {
        categories.providerLiteral.items.push({ docTitle, ko, en });
      }

      // 8. 질환을 가지고 있다
      if (/(?:질환|질병|문제|암|당뇨|고혈압|감염)(?:을|를)\s*가지고\s*(?:있|계신)/u.test(ko) && categories.haveDisease.items.length < 8) {
        categories.haveDisease.items.push({ docTitle, ko, en });
      }

      // 9. 기타
      if (/(?:살펴보세요|확인해\s*보세요|체크하세요|보호를\s*받으세요)/u.test(ko) && categories.awkwardTerminology.items.length < 8) {
        categories.awkwardTerminology.items.push({ docTitle, ko, en });
      }
    }
  }

  writeFileSync('scratch/awkward-samples.json', JSON.stringify(categories, null, 2), 'utf8');
  console.log('Samples extracted to scratch/awkward-samples.json');
}

extractSamples().catch(console.error);
