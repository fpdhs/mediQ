import fs from 'node:fs';

const filePath = 'scripts/medlineplus-local-preview.js';
const isCRLF = fs.readFileSync(filePath, 'utf8').includes('\r\n');
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

const replacement = [
  ' insufficientAnswer:retrieval=>{',
  '  if(retrieval.status===\'REFUSED\'){',
  '   const q=retrieval.question??\'\';',
  '   if(/운동|식단|음식|식품|영양|다이어트|예방|방지/u.test(q))',
  '    return \'특정 질환의 치료법이나 운동·예방 권고는 제공하지 않아요. 건강 관리와 운동 방법은 담당 의료진과 상담해 주세요.\';',
  '   if(/약|약물|의약품|처방|복용|투여|용량/u.test(q))',
  '    return \'약물의 처방이나 복약 용량에 대한 안내는 제공하지 않아요. 복용 관련 상담은 의료진 또는 약사와 확인해 주세요.\';',
  '   if(/진단|확진|판정|암인가|암이야|암인지/u.test(q))',
  '    return \'검사 수치나 증상으로 질환을 진단하거나 확정할 수는 없어요. 정확한 진단은 담당 의료진에게 문의해 주세요.\';',
  '   return \'진단이나 치료·처방 판단은 제공하지 않아요. 증상과 검사 결과는 의료진에게 확인해 주세요.\';',
  '  }',
  '  if(retrieval.status===\'PERSONAL_INPUT_NOT_SUPPORTED\')',
  '   return \'개인 건강상태·증상·검사결과의 개별 상담은 지원하지 않아요. 식별정보나 개인 검사 수치는 입력하지 마시고, 궁금한 점은 담당 의료진에게 문의해 주세요.\';',
  '  return (education||scenario)?`이 질문에 답할 충분한 근거가 없습니다. 현재 ${detailedScope}만 지원합니다.`:\'질문에 답할 공개 근거가 충분하지 않습니다. 개인정보 없이 화면에 표시된 지원 주제의 개념을 질문해 주세요.\';',
  ' },'
];

lines.splice(123, 3, ...replacement);
const newline = isCRLF ? '\r\n' : '\n';
fs.writeFileSync(filePath, lines.join(newline), 'utf8');
console.log('Successfully updated scripts/medlineplus-local-preview.js!');
