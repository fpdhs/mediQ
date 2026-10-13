// Editorial update dates derived from fixed, hashed public-source HTML snapshots.
// These dates track source-page metadata only; they are not clinical or legal approval.
const sourceUpdatedAtByUrl=Object.freeze({
 'https://medlineplus.gov/lab-tests/vision-screening/':'2026-07-15',
 'https://medlineplus.gov/lab-tests/hearing-tests-for-adults/':'2023-10-25',
 'https://medlineplus.gov/lab-tests/hemoglobin-test/':'2024-10-27',
 'https://medlineplus.gov/lab-tests/ast-test/':'2024-11-05',
 'https://medlineplus.gov/lab-tests/alt-blood-test/':'2024-11-05',
 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/':'2024-07-29',
 'https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/':'2026-09-30',
 'https://medlineplus.gov/lab-tests/protein-in-urine/':'2024-12-02',
 'https://medlineplus.gov/lab-tests/cholesterol-levels/':'2024-10-15',
 'https://medlineplus.gov/lab-tests/triglycerides-test/':'2024-12-09',
 'https://medlineplus.gov/lab-tests/hepatitis-testing/':'2025-09-29',
 'https://medlineplus.gov/lab-tests/lung-function-tests/':'2023-10-24',
 'https://medlineplus.gov/lab-tests/dental-exam/':'2026-08-25',
 'https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/':'2026-06-30',
 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/':'2025-09-04',
 'https://medlineplus.gov/lab-tests/liver-function-tests/':'2023-12-05',
 'https://medlineplus.gov/lab-tests/blood-glucose-test/':'2024-12-30',
 'https://medlineplus.gov/lab-tests/creatinine-test/':'2023-12-05',
 'https://medlineplus.gov/lab-tests/measuring-blood-pressure/':'2024-08-26',
 'https://medlineplus.gov/lab-tests/obesity-screening/':'2026-09-17',
 'https://medlineplus.gov/lab-tests/sonogram/':'2026-08-17',
 'https://medlineplus.gov/ctscans.html':'2026-01-26',
 'https://medlineplus.gov/xrays.html':'2026-01-22',
});

export function sourceUpdatedAtForUrl(url){
 return typeof url==='string'?sourceUpdatedAtByUrl[url]??null:null;
}

export {sourceUpdatedAtByUrl};
