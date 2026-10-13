// Explicit opt-in. Selection is memory-only and limited to authenticated records.
export function createHealthSharePicker(root,{onChange=()=>{}}={}){
  let rows=[],selected=new Set();
  const api={
    ids:()=>rows.filter(r=>selected.has(r.id)).map(r=>r.id),
    titles:()=>rows.filter(r=>selected.has(r.id)).map(r=>`${r.title} · ${r.date}`),
    reset(){selected.clear();api.update([]);},
    update(records=[]){
      rows=records;selected=new Set([...selected].filter(id=>rows.some(r=>r.id===id)));
      if(!root)return;
      root.replaceChildren();
      const heading=document.createElement('h3');heading.textContent='건강기록도 함께 전달할까요?';root.append(heading);
      const note=document.createElement('p');note.textContent='선택한 기록만 받는 병원이 열람합니다. 선택하지 않아도 영상 공유는 가능합니다.';root.append(note);
      if(!rows.length){const empty=document.createElement('p');empty.textContent='공유 가능한 건강기록을 확인 중이거나 아직 불러오지 못했어요.';root.append(empty);}
      for(const row of rows){
        const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');
        box.type='checkbox';box.checked=selected.has(row.id);box.disabled=false;
        text.textContent=`${row.title} · ${row.date}`;
        box.addEventListener('change',()=>{box.checked?selected.add(row.id):selected.delete(row.id);onChange();});
        label.append(box,text);root.append(label);
      }
    }
  };return api;
}
