import fs from 'node:fs';

const filePath = 'src/health-helper-medlineplus.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add isNonAnswerListLead export
const defTarget = `export const sha256 = value => \`sha256:\${createHash('sha256').update(value).digest('hex')}\`;`;
const defReplacement = `export const sha256 = value => \`sha256:\${createHash('sha256').update(value).digest('hex')}\`;
export const isNonAnswerListLead = sentence => /(?:다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\\s*같습니다|다음에\\s*해당합니다|다음이\\s*포함됩니다|포함될\\s*수\\s*있습니다|포함할\\s*수\\s*있습니다|다음과\\s*같은\\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\\s*다음과\\s*같습니다)[.:：]?\\s*$/u.test(sentence?.trim()??'');`;

if (!content.includes(defTarget)) {
  console.error('sha256 target not found!');
  process.exit(1);
}
content = content.replace(defTarget, defReplacement);

// 2. Add isNonAnswerListLead(answer) check in validateEducationOutput
const checkTarget = `if (texts.some((t,index) => typeof t !== 'string'
    || /[<>\\u0000-\\u001f]|https?:|www\\.|복용하세요|처방|확진|암입니다|수술하세요|치료하세요|대비\\s*물질/u.test(t)`;

const checkReplacement = `if (isNonAnswerListLead(answer) || texts.some((t,index) => typeof t !== 'string'
    || /[<>\\u0000-\\u001f]|https?:|www\\.|복용하세요|처방|확진|암입니다|수술하세요|치료하세요|대비\\s*물질/u.test(t)`;

if (!content.includes(checkTarget)) {
  console.error('checkTarget not found!');
  process.exit(1);
}
content = content.replace(checkTarget, checkReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated src/health-helper-medlineplus.js with isNonAnswerListLead guardrail!');
