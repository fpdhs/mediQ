const topics={'간 효소 AST':'AST','간 효소 ALT':'ALT','간 효소 γ-GTP':'GGT'};
export function comparisonMetrics(records=[]){
  const metrics=new Map();
  for(const record of records.filter(r=>r.synthetic===true)){
    const add=(label,value,unit)=>{
      if(!metrics.has(label))metrics.set(label,{id:`metric-${label}`,title:label,kind:topics[label]??(label==='혈청 AFP'?'AFP':'CHECKUP'),points:[]});
      metrics.get(label).points.push({date:record.date,value,unit,hospital:record.hospital,method:record.method,referenceRange:record.referenceRange??null});
    };
    if(record.kind==='AFP')add('혈청 AFP',record.value,record.unit);
    if(record.kind==='CHECKUP')for(const field of record.fields??[])add(field.label,field.value,field.unit);
  }
  return [...metrics.values()].map(metric=>({...metric,points:metric.points.sort((a,b)=>a.date.localeCompare(b.date))}));
}
export function compareHealthPoints(previous,current){
  if(!previous||!current)return {status:'MISSING',message:'비교할 두 기록이 필요해요.'};
  if(previous.date>=current.date)return {status:'INVALID',message:'이전 날짜와 이후 날짜를 선택해 주세요.'};
  if(previous.unit!==current.unit||!previous.method||previous.method!==current.method)return {status:'INCOMPATIBLE',message:'단위·검사 방법 확인이 필요해 수치 계산을 보류했어요.'};
  if(!Number.isFinite(previous.value)||!Number.isFinite(current.value))return {status:'TEXT',message:'두 결과를 나란히 확인해 주세요. 숫자 증가율을 계산하지 않습니다.'};
  const difference=current.value-previous.value;
  return {status:'NUMERIC',difference,percent:previous.value>0?difference/previous.value*100:null,message:previous.hospital===current.hospital?'합성 수치 비교 · 진단·악화 판정 아님':'검사기관이 다릅니다 · 산술 차이이며 임상적 비교 가능성을 뜻하지 않아요.'};
}
export const formatHealthNumber=value=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:1}):String(value??'미등록');
