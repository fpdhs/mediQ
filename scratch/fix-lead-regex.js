import fs from 'node:fs';

for (const filePath of ['src/medlineplus-upload-corpus.js', 'src/health-helper-medlineplus.js']) {
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    `다음에\\s*해당하면.{0,20}(?:알리|문의|상담)`,
    `다음에\\s*해당하면.{0,20}(?:알리|문의|상담)[가-힣]*`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}!`);
}
