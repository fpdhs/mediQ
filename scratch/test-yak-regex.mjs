const yakPattern = /(?:(?<![가-힣])약(?:[은는이가을를도과와에]|이나|으로)?(?![가-힣])|약물|의약품)/u;

const positive = [
  '약',
  '약을 먹어야 하나요?',
  '무슨 약을 복용하나요?',
  '약이 필요한가요?',
  '약은 어떻게 먹나요?',
  '약물 치료',
  '의약품 복용'
];

const negative = [
  '만약 간경화라면',
  '약간 어지러워요',
  '진료 예약하고 싶어요',
  '검사 결과를 요약해 주세요',
  '몸이 취약해졌어요',
  '대략적인 기간'
];

console.log('Positive cases (should be true):');
for (const p of positive) {
  console.log(p, yakPattern.test(p));
}

console.log('\nNegative cases (should be false):');
for (const n of negative) {
  console.log(n, yakPattern.test(n));
}
