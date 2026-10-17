async page=>{
 const mobile=new URL(page.url()).pathname.startsWith('/mobile/');
 const root=page.locator('#patient-health-helper:visible');
 await root.locator('.helper-expanded-card').waitFor();
 const checks=[];
 if(await root.locator('.mq-wallet-dock button').count()!==3)throw Error('REMAINING_CARDS');
 checks.push('original-wallet-three-other-cards');
 const color=await root.locator('.helper-pocket').evaluate(el=>getComputedStyle(el).backgroundColor);
 if(color!=='rgb(229, 237, 246)')throw Error('POCKET_COLOR:'+color);
 checks.push('bluegray-pocket');
 if(mobile){if(await root.locator('.helper-mobile-notes').getAttribute('open')===null)await root.locator('.helper-mobile-notes>summary').click();checks.push('mobile-notes-disclosure');}
 await root.getByRole('button',{name:'+ 담기',exact:true}).first().click();
 const note=root.getByRole('textbox',{name:'담은 질문 1 수정'});
 await note.fill('이전 검사와 함께 어떻게 이해하면 좋을까요?');
 await root.locator('.helper-new-chat').click();
 if(await note.inputValue()!=='이전 검사와 함께 어떻게 이해하면 좋을까요?')throw Error('NOTE_LOST');
 checks.push('save-edit-new-conversation-preserves-note');
 await root.locator('.helper-comparison-drawer>summary').click();checks.push('comparison-disclosure');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 if(overflow)throw Error('HORIZONTAL_OVERFLOW');
 checks.push('no-horizontal-overflow');
 await page.screenshot({path:'output/playwright/helper-extracted-'+(mobile?'mobile':'web')+'-20261012.png',fullPage:true});
 return {scope:'LOCAL_UI_OVERLAY_REAL_BACKEND',surface:mobile?'mobile':'web',checks,apiMocked:false};
}
