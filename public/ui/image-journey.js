// Presentation-only state. Never issues a request, grants access or records evidence.
import {SECURITY_GATES} from './security-gates.js';
import {mountJourneyLens} from './journey-lens.js';
export function journeyState(mode='view', index=0, scenario='normal') {
  mode = mode === 'store' ? 'store' : 'view';
  const steps=SECURITY_GATES.map(g=>[g.name,g.title,g.check]);
  index=Math.min(steps.length-1,Math.max(0,Number.isInteger(index)?index:0));
  const denied=scenario==='denied', unavailable=scenario==='unavailable';
  return {mode,index,steps,gate:SECURITY_GATES[index],denied,unavailable,
    title:denied?'권한이 맞지 않아 여기서 멈춰요':unavailable?'확인하지 못한 것은 거부가 아니에요':steps[index][1],
    description:denied?SECURITY_GATES[index].example:unavailable?'서버 응답이 없으면 확인 실패로 표시합니다. 접근 허용이나 정책상 거부로 바꾸어 표시하지 않습니다.':steps[index][2],
    canNext:!denied&&!unavailable&&index<steps.length-1};
}

export function mountImageJourney(root) {
  if(!root || root.dataset.bound) return;
  root.dataset.bound='true';
  let mode='view',index=0,scenario='normal',overview=true;
  const lens=mountJourneyLens(root);
  const makeImage=gate=>{
    const img=document.createElement('img');
    img.src=gate.image;img.alt=gate.imageAlt;img.width=1536;img.height=1024;
    img.loading='lazy';img.decoding='async';
    return img;
  };
  const gallery=root.querySelector('[data-journey-gallery]');
  gallery.replaceChildren(...SECURITY_GATES.map((gate,i)=>{
    const button=document.createElement('button'),number=document.createElement('span'),title=document.createElement('strong'),copy=document.createElement('span');
    button.type='button';button.className='journey-gallery-card';button.dataset.journeyGate=String(i);
    number.className='journey-card-number';number.textContent=String(i+1).padStart(2,'0');
    title.textContent=gate.name;copy.className='journey-card-copy';copy.textContent=gate.title;
    button.append(makeImage(gate),number,title,copy);return button;
  }));
  const image=root.querySelector('[data-journey-image]');
  image.addEventListener('error',()=>{
    image.hidden=true;root.querySelector('[data-journey-image-error]').hidden=false;
  });
  image.addEventListener('load',()=>{
    image.hidden=false;root.querySelector('[data-journey-image-error]').hidden=true;
  });
  const render=()=>{
    const model=journeyState(mode,index,scenario);
    root.dataset.mode=mode;root.dataset.step=String(index);root.dataset.scenario=scenario;
    root.dataset.overview=String(overview);
    lens.update(model,overview);
    root.querySelector('[data-journey-overview]').hidden=!overview;
    root.querySelector('[data-journey-detail]').hidden=overview;
    root.querySelector('[data-journey-controls]').hidden=overview;
    root.querySelector('[data-journey-scenarios-panel]').hidden=overview;
    if(!overview && image.getAttribute('src')!==model.gate.image){
      image.hidden=false;root.querySelector('[data-journey-image-error]').hidden=true;
      image.src=model.gate.image;
    }
    image.alt=model.gate.imageAlt;
    root.querySelectorAll('[data-journey-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.journeyMode===mode)));
    root.querySelectorAll('[data-journey-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.journeyScenario===scenario)));
    root.querySelector('[data-journey-title]').textContent=model.title;
    root.querySelector('[data-journey-description]').textContent=model.description;
    root.querySelector('[data-journey-status]').textContent=`보안 관문 ${index+1}/8 · ${model.denied?'조건 불일치 예시':model.unavailable?'확인 실패 예시':model.steps[index][0]}`;
    for(const key of ['block','where','tech','limit'])root.querySelector(`[data-gate-${key}]`).textContent=model.gate[key];
    root.querySelector('[data-journey-previous]').disabled=index===0;
    root.querySelector('[data-journey-next]').disabled=!model.canNext;
    const list=root.querySelector('[data-journey-steps]');
    list.replaceChildren(...model.steps.map(([title],i)=>{
      const li=document.createElement('li'), marker=document.createElement('span'),label=document.createElement('button');
      label.type='button';label.dataset.journeyGate=String(i);label.setAttribute('aria-pressed',String(i===index));
      li.dataset.active=String(i===index);if(i===index)li.setAttribute('aria-current','step');
      marker.textContent=String(i+1);label.textContent=title;li.append(marker,label);return li;
    }));
  };
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const wasOverview=overview;
    if(button.hasAttribute('data-journey-mode')) {mode=button.dataset.journeyMode;index=0;scenario='normal';}
    else if(button.hasAttribute('data-journey-scenario')) {scenario=button.dataset.journeyScenario;}
    else if(button.hasAttribute('data-journey-next')) {if(journeyState(mode,index,scenario).canNext)index++;}
    else if(button.hasAttribute('data-journey-previous')) {index=Math.max(0,index-1);scenario='normal';}
    else if(button.hasAttribute('data-journey-gate')) {index=Number(button.dataset.journeyGate);scenario='normal';overview=false;}
    else if(button.hasAttribute('data-journey-start')) {index=0;scenario='normal';overview=false;}
    else if(button.hasAttribute('data-journey-reset')) {index=0;scenario='normal';overview=false;}
    else if(button.hasAttribute('data-journey-home')) {overview=true;scenario='normal';}
    else return;
    render();
    if(wasOverview&&!overview){
      const heading=root.querySelector('[data-journey-title]');heading.tabIndex=-1;heading.focus({preventScroll:true});
    }else if(overview)root.querySelector('[data-journey-start]').focus({preventScroll:true});
    else if(button.hasAttribute('data-journey-gate'))root.querySelector(`.journey-steps [data-journey-gate="${index}"]`).focus({preventScroll:true});
  });
  render();
}
if(typeof document!=='undefined')mountImageJourney(document.querySelector('#image-journey'));
