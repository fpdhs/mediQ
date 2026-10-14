import fs from 'node:fs';

const filePath = 'src/medlineplus-upload-corpus.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update isNonAnswerListLead
const leadTarget = `const isNonAnswerListLead=sentence=>/다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)/u.test(sentence);`;
const leadReplacement = `export const isNonAnswerListLead=sentence=>/(?:다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\\s*같습니다|다음에\\s*해당합니다|다음이\\s*포함됩니다|포함될\\s*수\\s*있습니다|포함할\\s*수\\s*있습니다|다음과\\s*같은\\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\\s*다음과\\s*같습니다)[.:：]?\\s*$/u.test(sentence?.trim()??'');`;

if (!content.includes(leadTarget)) {
  console.error('Lead target not found!');
  process.exit(1);
}
content = content.replace(leadTarget, leadReplacement);

// 2. Add CLINICAL_COLLOQUIAL_ALIASES and update koreanTitleAliases
const aliasTarget = `function koreanTitleAliases(title){
 if(typeof title!=='string')return [];
 const parenthetical=(title.match(/\\([^()]{2,16}\\)/g)??[]).map(value=>value.slice(1,-1));
 const translatedSynonyms=title==='백신'?['예방접종']:[];
 return [...parenthetical,...translatedSynonyms];
}`;

const aliasReplacement = `const CLINICAL_COLLOQUIAL_ALIASES=Object.freeze({
 '간경변증':['간경화','복수','간이 굳음','배에 물이 참','간섬유화'],
 '간 질환':['간질환','간 수치','간수치','피검사 간 수치','간기능 이상','간 손상'],
 '간암':['간의 암','간 종양','간세포암'],
 '황달':['눈이 노람','피부가 노람','눈 흰자위 노란색','노란 피부','노란 소변','몸이 노람'],
 '지방간질환':['지방간','비알코올성 지방간'],
 'B형 간염':['B형간염','만성 B형간염'],
 'C형 간염':['C형간염','만성 C형간염'],
 '고혈압':['혈압이 높음','높은 혈압'],
 '천식':['숨이 참','숨이 차요','쌕쌕거림','천명음','숨쉬기 힘듦'],
 '위식도역류질환':['역류성 식도염','식도염','위산 역류','속쓰림','신물 올라옴'],
 '제2형 당뇨병':['당뇨','당뇨병','혈당 높음','공복혈당'],
 '빈혈':['철분 부족','어지럼증','헤모글로빈 낮음','피가 부족'],
 '소변검사':['요검사','소변 검사','소변 색','단백뇨','혈뇨'],
});

function koreanTitleAliases(title){
 if(typeof title!=='string')return [];
 const parenthetical=(title.match(/\\([^()]{2,16}\\)/g)??[]).map(value=>value.slice(1,-1));
 const base=title.replace(/\\([^)]*\\)/g,'').trim();
 const colloquial=CLINICAL_COLLOQUIAL_ALIASES[title]??CLINICAL_COLLOQUIAL_ALIASES[base]??[];
 const translatedSynonyms=title==='백신'?['예방접종']:[];
 return [...parenthetical,...colloquial,...translatedSynonyms];
}`;

if (!content.includes(aliasTarget)) {
  console.error('Alias target not found!');
  process.exit(1);
}
content = content.replace(aliasTarget, aliasReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated isNonAnswerListLead and koreanTitleAliases in src/medlineplus-upload-corpus.js!');
