import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const runtime=process.argv[2];
if(!runtime)throw Error('Provide the installed playwright/index.mjs path');
const {chromium}=await import(pathToFileURL(runtime).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
const folder='output/playwright/patient-wallet-unified';
await mkdir(folder,{recursive:true});
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3000/#PATIENT');
    await page.locator('.mq-wallet-home .mq-wallet-art').waitFor();
    const home=page.locator('.mq-wallet-home .mq-wallet-object');
    const inspect=wallet=>wallet.evaluate(root=>({
      cards:[...root.querySelectorAll('.mq-wallet-card')].map(card=>{
        const s=getComputedStyle(card);
        return {route:card.dataset.walletRoute,angle:s.getPropertyValue('--angle'),lift:s.getPropertyValue('--lift'),
          radius:s.borderRadius,background:s.backgroundImage,display:s.display,
          title:card.querySelector('strong').textContent,cta:!!card.querySelector('.mq-card-cta')};
      }),art:root.querySelector('img').getAttribute('src'),
      loaded:root.querySelector('img').complete&&root.querySelector('img').naturalWidth>0
    }));
    const expected=await inspect(home);assert.equal(expected.loaded,true);
    await home.screenshot({path:`${folder}/home-${width}.png`});
    for(const route of ['records','helper','sharing','requests']) {
      const wallet=route==='records'?home:page.locator('#patient-portal-app .page:visible > .mq-wallet-dock');
      await wallet.locator(`[data-wallet-route="${route}"]`).click();
      const dock=page.locator('#patient-portal-app .page:visible > .mq-wallet-dock');
      await dock.waitFor();
      await page.mouse.move(0,0);
      assert.deepEqual(await inspect(dock),expected);
      assert.equal(await dock.locator('[aria-current="page"]').getAttribute('data-wallet-route'),route);
      await dock.screenshot({path:`${folder}/${route}-${width}.png`});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,result:'PASS',checks:['home/dock card styles','artwork','four menu routes','current page','no overflow','no page errors']}));
    await page.close();
  }
} finally {await browser.close();}
