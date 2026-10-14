import fs from 'node:fs';

// 1. Update src/health-helper-liver-evidence.js
{
  const filePath = 'src/health-helper-liver-evidence.js';
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    `const detailIntentPatterns=[['PURPOSE',/목적|왜|무엇.*검사|사용하|하는.*검사/],`,
    `const detailIntentPatterns=[['PURPOSE',/목적|왜|무엇.*검사|사용하|하는.*검사|설명|알려/],`
  );

  content = content.replace(
    `const panel=/간\\s*기능(?:\\s*검사)?|간기능|간\\s*패널|liver\\s*function/i.test(question);`,
    `const panel=/간\\s*기능(?:\\s*검사)?|간기능|간\\s*패널|liver\\s*function|간\\s*수치|피검사\\s*간\\s*수치/i.test(question);`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated src/health-helper-liver-evidence.js!');
}

// 2. Update src/medlineplus-upload-corpus.js
{
  const filePath = 'src/medlineplus-upload-corpus.js';
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    `export const isNonAnswerListLead=sentence=>/(?:다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\\s*같습니다|다음에\\s*해당합니다|다음이\\s*포함됩니다|포함될\\s*수\\s*있습니다|포함할\\s*수\\s*있습니다|다음과\\s*같은\\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\\s*다음과\\s*같습니다)[.:：]?\\s*$/u.test(sentence?.trim()??'');`,
    `export const isNonAnswerListLead=sentence=>/(?:다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\\s*같습니다|다음에\\s*해당합니다|다음이\\s*포함됩니다|포함될\\s*수\\s*있습니다|포함할\\s*수\\s*있습니다|다음에\\s*해당하면.{0,20}(?:알리|문의|상담)|다음과\\s*같은\\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\\s*다음과\\s*같습니다)[.:：]?\\s*$/u.test(sentence?.trim()??'');`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated src/medlineplus-upload-corpus.js isNonAnswerListLead pattern!');
}

// 3. Update src/health-helper-medlineplus.js
{
  const filePath = 'src/health-helper-medlineplus.js';
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    `export const isNonAnswerListLead = sentence => /(?:다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\\s*같습니다|다음에\\s*해당합니다|다음이\\s*포함됩니다|포함될\\s*수\\s*있습니다|포함할\\s*수\\s*있습니다|다음과\\s*같은\\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\\s*다음과\\s*같습니다)[.:：]?\\s*$/u.test(sentence?.trim()??'');`,
    `export const isNonAnswerListLead = sentence => /(?:다음과\\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\\s*같습니다|다음에\\s*해당합니다|다음이\\s*포함됩니다|포함될\\s*수\\s*있습니다|포함할\\s*수\\s*있습니다|다음에\\s*해당하면.{0,20}(?:알리|문의|상담)|다음과\\s*같은\\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\\s*다음과\\s*같습니다)[.:：]?\\s*$/u.test(sentence?.trim()??'');`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated src/health-helper-medlineplus.js isNonAnswerListLead pattern!');
}
