import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const playwrightPath = pathToFileURL('C:/Users/user/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core/index.mjs').href;
const { chromium } = await import(playwrightPath);

const outputDir = path.resolve('docs/assets/images');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  ignoreHTTPSErrors: true
});

const page = await context.newPage();

try {
  console.log('1. Capturing Main Landing Screen...');
  await page.goto('https://highpass-demo.japaneast.cloudapp.azure.com/hipass/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outputDir, '01_main_landing.png') });

  console.log('2. Capturing Patient Login Screen...');
  await page.getByRole('button', { name: '환자로 시작하기' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outputDir, '02_patient_login.png') });

  console.log('3. Capturing Clinician Login Screen...');
  await page.getByRole('button', { name: '시작 화면으로' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '의료진으로 시작하기' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outputDir, '03_clinician_login.png') });

  console.log('4. Capturing Security Admin Login Screen...');
  await page.getByRole('button', { name: '시작 화면으로' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '보안 운영자 전용 로그인' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outputDir, '04_security_admin_login.png') });

  console.log('5. Capturing AI Health Helper RAG Workbench...');
  await page.goto('http://127.0.0.1:3099/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  // Click AFP scenario
  const afpBtn = page.getByRole('button', { name: '검색 일치 AFP 검사는 무엇을 확인하나요?' });
  if (await afpBtn.count() > 0) {
    await afpBtn.click();
    console.log('Waiting for RAG answer...');
    await page.waitForTimeout(4000);
  }
  await page.screenshot({ path: path.join(outputDir, '05_health_helper_rag.png') });

  console.log('All live screens captured successfully!');
} catch (err) {
  console.error('Capture failed:', err);
} finally {
  await browser.close();
}
