import fs from 'node:fs';
import path from 'node:path';

const targets = [
  '담당 의료진에게 문의해 주세요',
  '개인 진단을 내릴 수는 없어요',
  '암을 확정하거나 개인 진단'
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', '.playwright-cli', 'tmp'].includes(entry.name)) {
        walk(full);
      }
    } else if (entry.isFile() && /\.(js|html|css|md|txt|json)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        for (const t of targets) {
          if (content.includes(t)) {
            console.log(`FOUND "${t}" in ${full}`);
          }
        }
      } catch (e) {}
    }
  }
}

for (const dir of ['public', 'src', 'docs', 'fixtures', 'scripts', 'test', 'artifacts']) {
  if (fs.existsSync(dir)) walk(dir);
}
console.log('Search finished.');
