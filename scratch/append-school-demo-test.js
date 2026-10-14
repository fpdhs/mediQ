import fs from 'node:fs';

const filePath = 'test/health-helper-school-demo-medical-tests.test.js';
let content = fs.readFileSync(filePath, 'utf8');

const newTest = `
test('liver enzyme and AFP comparison scenario questions retrieve CANDIDATE with verified source', () => {
 const ast = retrieveSchoolDemoCandidateEvidence('AST: 이 검사는 무엇을 확인하나요?', combined, addendum);
 assert.equal(ast.status, 'CANDIDATE');
 assert.match(ast.evidence[0].text_ko, /AST/);
 assert.equal(ast.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/ast-test/');

 const alt = retrieveSchoolDemoCandidateEvidence('ALT: 이 검사는 무엇을 확인하나요?', combined, addendum);
 assert.equal(alt.status, 'CANDIDATE');
 assert.match(alt.evidence[0].text_ko, /ALT/);
 assert.equal(alt.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/alt-blood-test/');

 const ggt = retrieveSchoolDemoCandidateEvidence('GGT: 이 검사는 무엇을 확인하나요?', combined, addendum);
 assert.equal(ggt.status, 'CANDIDATE');
 assert.match(ggt.evidence[0].text_ko, /GGT/);
 assert.equal(ggt.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/');

 const comp = retrieveSchoolDemoCandidateEvidence('AFP: 이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?', combined, addendum);
 assert.equal(comp.status, 'CANDIDATE');
 assert.match(comp.evidence[0].text_ko, /검사기관마다 검사 방법과 참고범위가 달라/);
 assert.equal(comp.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/');
});
`;

content = content.trimEnd() + '\n' + newTest;
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully appended test to test/health-helper-school-demo-medical-tests.test.js!');
