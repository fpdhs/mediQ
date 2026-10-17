let page=1;
const total=63,input=document.getElementById('page-number'),image=document.getElementById('slide-preview');
const previous=document.getElementById('previous'),next=document.getElementById('next');
function showPage(value){const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<1||parsed>total){input.value=String(page);return;}page=parsed;input.value=String(page);image.src='../assets/documents/mediq-project-pages/slide-'+String(page).padStart(2,'0')+'.jpg';image.alt='Medi Q 발표자료 '+page+'페이지';document.getElementById('page-status').textContent=page+' / '+total+'페이지';previous.disabled=page===1;next.disabled=page===total;}
previous.addEventListener('click',()=>showPage(page-1));next.addEventListener('click',()=>showPage(page+1));input.addEventListener('change',()=>showPage(input.value));
document.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowLeft'){event.preventDefault();showPage(page-1);}if(event.key==='ArrowRight'){event.preventDefault();showPage(page+1);}});
