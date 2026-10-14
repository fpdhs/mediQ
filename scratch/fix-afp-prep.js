import fs from 'node:fs';

const filePath = 'src/health-helper-school-demo-medical-tests.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `  if(/(?:비교|이전|지난|추세)/u.test(question)){
   const comp=retrieveAfpEvidence(question);
   if(comp.status==='CANDIDATE')return adaptScenarioEvidence(comp);
   return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  }`;

const replacement = `  if(/(?:비교|이전|지난|추세|준비|기록|챙겨)/u.test(question)){
   const comp=retrieveAfpEvidence(question);
   if(comp.status==='CANDIDATE')return adaptScenarioEvidence(comp);
   return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  }`;

if (!content.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}
content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated AFP preparation routing!');
