import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('helper skin is wired on web and mobile without replacing the shared authenticated renderer',()=>{
 for(const path of ['public/app.js','public/mobile/app.js'])assert.match(read(path),/createHelperSurface\(document.querySelector\('#patient-health-helper'\)/);
 const adapter=read('public/ui/wallet-home.js').split('export function createHelperSurface')[1].split('const cardDefinitions')[0];
 assert.match(adapter,/selected:'helper'/);assert.match(adapter,/comparison.before\(drawer\);drawer.append\(comparison\)/);
 assert.doesNotMatch(adapter,/fetch\(|innerHTML|localStorage|sessionStorage/);
});
test('question pocket has explicit bluegray white navy tokens and responsive layout',()=>{
 const css=read('public/ui/wallet-record-sheet.css');
 assert.match(css,/#patient-health-helper.helper-extracted-sheet .helper-pocket\{background:#e5edf6/);
 assert.match(css,/#patient-health-helper.helper-extracted-sheet .helper-card\{background:#fff;border:1px solid #c7d5e7;color:#192638/);
 assert.match(css,/@media\(max-width:850px\)\{#patient-health-helper.helper-extracted-sheet .helper-grid\{grid-template-columns:1fr/);
});
