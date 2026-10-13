// Presentation only: a consent is not proof of hospital receipt or viewing.
export function walletConsentState(consent, now = Date.now()) {
  if (consent.status === 'REVOKED') return '공유 중단';
  const from = Date.parse(consent.validFrom), until = Date.parse(consent.validUntil);
  if (consent.status === 'EXPIRED' || Number.isFinite(until) && now >= until) return '기간 만료';
  if (consent.status === 'ACTIVE' && Number.isFinite(from) && Number.isFinite(until) && from <= now && now < until) return '공유 동의 유효';
  return '상태 확인 필요';
}
const node = (tag, cls, text) => {
  const item = document.createElement(tag); item.className = cls;
  if (text !== undefined) item.textContent = text;
  return item;
};
const hospital = id => ({'HOSP-A':'A대학병원','HOSP-B':'B대학병원','HOSP-C':'C대학병원'}[id] || id || '병원 미확인');
const icon = type => {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d',({requests:'M7 3h10v3h3v15H4V6h3M8 12l3 3 5-6',records:'M5 3h10l4 4v14H5zM9 12h6M12 9v6',sharing:'M4 7h12m-4-4 4 4-4 4M20 17H8m4-4-4 4 4 4',helper:'M4 4h16v12H9l-5 4zM8 9h8M8 12h5'})[type]||'M4 4h16v16H4zM8 12h8M12 8v8');
  svg.append(path);return svg;
};
export {icon as createWalletIcon};
// Design adapter: retains the helper's authenticated requests, notes and source handlers.
export function createHelperSurface(root,navigate,mobile=false){
  if(!root||root.querySelector('.helper-expanded-card'))return;
  root.classList.add('helper-extracted-sheet');
  const sheet=node('section','helper-expanded-card');sheet.setAttribute('aria-label','내 지갑에서 꺼낸 건강도우미 카드');
  sheet.append(...root.children);root.append(sheet);
  const back=node('button','health-wallet-back','‹ 내 지갑으로');back.type='button';back.onclick=()=>navigate('home');sheet.prepend(back);
  const heading=sheet.querySelector('.helper-heading h1');
  if(heading)heading.prepend(icon('helper'));
  const pocket=sheet.querySelector('.helper-pocket'),title=pocket?.querySelector('h2');
  if(title)title.textContent='다음 진료에 가져갈 질문';
  const subtitle=pocket?.querySelector('.helper-pocket-subtitle');if(subtitle)subtitle.textContent='대화에서 나온 질문을 내 메모에 담아요.';
  const comparison=sheet.querySelector('.helper-comparison');
  if(comparison){const drawer=node('details','helper-comparison-drawer');drawer.append(node('summary','','이전 검사와 비교하기'));comparison.before(drawer);drawer.append(comparison);}
  if(mobile&&pocket){
    const drawer=node('details','helper-mobile-notes');drawer.append(node('summary','','내 진료 질문 보기'));pocket.before(drawer);drawer.append(pocket);
    sheet.querySelector('.helper-notes-jump')?.addEventListener('click',()=>{drawer.open=true;pocket.scrollIntoView({block:'start'});});
  }
  root.append(createWalletDock({selected:'helper',navigate}));
}
const cardDefinitions=[['requests','공유 내용 확인','내가 허용한 공유를 확인해요'],['records','내 건강기록','영상부터 건강검진까지'],['sharing','영상 공유','다음 병원에 안전하게'],['helper','건강도우미','내 기록을 알기 쉽게']];

// The same foreground artwork and menu vocabulary continue below an extracted card.
export function createWalletDock({selected,navigate,home=false}) {
  const wallet=node(home?'section':'nav',home?'mq-wallet-object':'mq-wallet-object mq-wallet-dock');
  wallet.setAttribute('aria-label',home?'내 의료 지갑 · 카드를 선택하세요':'내 지갑의 다른 카드');
  const cards=node('div','mq-wallet-cards');
  for(const [route,label,copy] of cardDefinitions) {
    const card=node('button',`mq-wallet-card mq-wallet-card-${route}`);card.type='button';card.dataset.walletRoute=route;
    const badge=node('span','mq-card-icon');badge.append(icon(route));
    card.append(badge,node('strong','',label),node('span','mq-card-copy',copy));
    if(route==='requests')card.append(node('span','mq-card-cta','확인하기'));
    card.setAttribute('aria-label',label);
    if(route===selected){card.setAttribute('aria-current','page');card.classList.add('is-selected');}
    card.onclick=()=>{if(route!==selected)navigate(route);};cards.append(card);
  }
  const pocket=node('div','mq-wallet-pocket');pocket.setAttribute('aria-hidden','true');
  const leather=node('img','mq-wallet-art');leather.src='/images/mediq-wallet-front-v1.webp';leather.alt='';leather.width=1905;leather.height=826;leather.decoding='async';pocket.append(leather);
  wallet.append(cards,pocket);return wallet;
}
export function mountPatientWalletDock(root,page,navigate){
  if(!root||page==='home')return null;
  const selected=({phr:'records',images:'records',health:'records',documents:'records',consent:'sharing',visit:'sharing',activity:'requests'})[page]||page;
  const existing=root.querySelector(':scope > .mq-wallet-dock');
  root.querySelectorAll('.mq-wallet-dock').forEach(dock=>{if(dock!==existing)dock.remove();});
  if(existing?.dataset.walletPage===page)return existing;
  root.querySelectorAll('.mq-wallet-dock').forEach(dock=>dock.remove());
  const dock=createWalletDock({selected,navigate:route=>navigate(({records:'phr',requests:'activity'})[route]||route)});
  dock.dataset.walletPage=page;
  root.append(dock);
  return dock;
}
export function createWalletHome({root, navigate}) {
  if (!root) return null;
  root.classList.add('wallet-home-host');
  const surface = node('div', 'mq-wallet-home');
  const greeting = node('header', 'mq-wallet-greeting');
  const title = node('h1', '');
  const salutation=node('span','mq-wallet-title-line','내 의료 지갑,');
  title.append(salutation,node('span','mq-wallet-title-line','다음 진료를 준비해요.'));
  const hello = node('p', 'mq-wallet-hello', '내 지갑을 확인하고 있어요.');
  greeting.append(title, hello);
  const overview = node('div','mq-wallet-overview');
  const records = node('section','mq-wallet-panel'), shares = node('section','mq-wallet-panel');
  const recordList = node('div','mq-wallet-list'), shareList = node('div','mq-wallet-list');
  const button = (text, route, cls='mq-wallet-link') => {
    const item=node('button',cls,text); item.type='button'; item.onclick=()=>navigate(route); return item;
  };
  for (const [panel, label, route, list] of [[records,'최근 건강기록','records',recordList],[shares,'최근 공유 현황','history',shareList]]) {
    const head=node('div','mq-wallet-panel-head'); head.append(node('h2','',label),button('모두 보기 ↗',route)); panel.append(head,list);
  }
  overview.append(records,shares);
  const wallet = createWalletDock({home:true,navigate});
  let busy=false, timer, expiryTimer;
  const buttons=Array.from(wallet.querySelectorAll('.mq-wallet-card'));
  for(const card of buttons) {
    const route=card.dataset.walletRoute;
    card.onclick=()=>{
      if(busy)return;busy=true;card.classList.add('is-extracting');
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      timer=setTimeout(()=>{card.classList.remove('is-extracting');busy=false;navigate(route);},reduced?0:180);
    };
  }
  const top=node('div','mq-wallet-top');top.append(greeting,overview);
  surface.append(top,wallet,node('p','mq-wallet-swipe-hint','카드를 옆으로 넘겨보세요'),node('p','mq-wallet-disclosure','합성 시연 데이터 · 공유 현황은 동의 상태이며 병원의 열람·수신 완료를 뜻하지 않습니다.'));
  root.prepend(surface);
  const api={
    update({name='환자',records:rows=[],consents=[],ready=false,error=false}) {
      salutation.textContent=`${name}님,`;
      clearTimeout(expiryTimer);
      if(ready&&consents.length){
        const deadlines=consents.flatMap(c=>[Date.parse(c.validFrom),Date.parse(c.validUntil)]).filter(t=>Number.isFinite(t)&&t>Date.now());
        if(deadlines.length)expiryTimer=setTimeout(()=>api.update({name,records:rows,consents,ready}),Math.min(60000,Math.max(1,Math.min(...deadlines)-Date.now()+10)));
      }
      hello.textContent=`${name}님의 소중한 건강기록을 안전하게 보관하고, 필요할 때 확인하세요.`;
      recordList.replaceChildren();shareList.replaceChildren();
      for(const row of (ready?rows:[]).slice(0,3)) {
        const item=button('', 'records','mq-wallet-row');
        const symbol=node('span','mq-record-symbol');symbol.append(icon('records'));
        item.append(symbol,node('strong','',row.title||'검사 기록'),node('small','',`${row.date||'검사일 미확인'} · ${row.hospital||'기관 미확인'}`));recordList.append(item);
      }
      if(!ready||!rows.length)recordList.append(node('p','mq-wallet-empty',error?'최신 기록을 확인하지 못했어요. 새로고침해 주세요.':ready?'등록된 건강기록이 없어요.':'기록을 확인하고 있어요.'));
      // Keep API order; no fabricated timestamps, incoming requests, or receipt events.
      for(const consent of (ready?consents:[]).slice(0,3)) {
        const item=button('', 'history','mq-wallet-row');
        const state=walletConsentState(consent),status=node('small','',state);status.dataset.walletState=state==='공유 동의 유효'?'active':'other';
        item.append(node('span','mq-share-symbol','↗'),node('strong','',`${hospital(consent.sourceHospitalId)} → ${hospital(consent.targetHospitalId)}`),status);shareList.append(item);
      }
      if(!ready||!consents.length)shareList.append(node('p','mq-wallet-empty',error?'공유 상태를 확인하지 못했어요. 새로고침해 주세요.':ready?'아직 공유한 영상이 없어요.':'공유 상태를 확인하고 있어요.'));
      buttons[0].querySelector('.mq-card-copy').textContent=ready?'내가 허용한 공유를 확인해요':'공유 정보를 확인하고 있어요';
    },
    reset(){clearTimeout(timer);busy=false;buttons.forEach(b=>b.classList.remove('is-extracting'));this.update({});},
  };
  window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(expiryTimer);});
  return api;
}
