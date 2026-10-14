import fs from 'node:fs';

const filePath = 'src/health-helper-patient-translation.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `   if(retrieval.status!=='CANDIDATE')return {...metadata,status:retrieval.status,generationUsed:false,sources:[],questions:[],
    answer:retrieval.status==='PERSONAL_INPUT_NOT_SUPPORTED'?'개인 검사 수치와 증상 해석은 지원하지 않아요. 검사 이름이나 일반적인 목적을 질문해 주세요.':
     retrieval.status==='REFUSED'?'진단이나 치료 판단은 의료진에게 확인해 주세요.':'이 질문에 답할 번역 근거를 찾지 못했어요. 검사 이름과 궁금한 내용을 구체적으로 적어 주세요.'};`;

const replacement = `   if(retrieval.status!=='CANDIDATE')return {...metadata,status:retrieval.status,generationUsed:false,sources:[],questions:[],
    answer:retrieval.status==='PERSONAL_INPUT_NOT_SUPPORTED'?'개인 검사 수치와 증상 해석은 지원하지 않아요. 검사 이름이나 일반적인 목적을 질문해 주세요.':
     retrieval.status==='REFUSED'?(
      /운동|식단|음식|식품|영양|다이어트|예방|방지/u.test(question)?'특정 질환의 치료법이나 운동·예방 권고는 제공하지 않아요. 건강 관리와 운동 방법은 담당 의료진과 상담해 주세요.':
      /약|약물|의약품|처방|복용|투여|용량/u.test(question)?'약물의 처방이나 복약 용량에 대한 안내는 제공하지 않아요. 복용 관련 상담은 의료진 또는 약사와 확인해 주세요.':
      /진단|확진|판정|암인가|암이야|암인지/u.test(question)?'검사 수치나 증상으로 질환을 진단하거나 확정할 수는 없어요. 정확한 진단은 담당 의료진에게 문의해 주세요.':
      '진단이나 치료·처방 판단은 제공하지 않아요. 증상과 검사 결과는 의료진에게 확인해 주세요.'
     ):'이 질문에 답할 번역 근거를 찾지 못했어요. 검사 이름과 궁금한 내용을 구체적으로 적어 주세요.'};`;

if (!content.includes('retrieval.status===\'REFUSED\'?\'진단이나 치료 판단은 의료진에게 확인해 주세요.\'')) {
  console.error('Target not found!');
  process.exit(1);
}

content = content.replace(
  `retrieval.status==='REFUSED'?'진단이나 치료 판단은 의료진에게 확인해 주세요.':`,
  `retrieval.status==='REFUSED'?(
      /운동|식단|음식|식품|영양|다이어트|예방|방지/u.test(question)?'특정 질환의 치료법이나 운동·예방 권고는 제공하지 않아요. 건강 관리와 운동 방법은 담당 의료진과 상담해 주세요.':
      /약|약물|의약품|처방|복용|투여|용량/u.test(question)?'약물의 처방이나 복약 용량에 대한 안내는 제공하지 않아요. 복용 관련 상담은 의료진 또는 약사와 확인해 주세요.':
      /진단|확진|판정|암인가|암이야|암인지/u.test(question)?'검사 수치나 증상으로 질환을 진단하거나 확정할 수는 없어요. 정확한 진단은 담당 의료진에게 문의해 주세요.':
      '진단이나 치료·처방 판단은 제공하지 않아요. 증상과 검사 결과는 의료진에게 확인해 주세요.'
     ):`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated src/health-helper-patient-translation.js!');
