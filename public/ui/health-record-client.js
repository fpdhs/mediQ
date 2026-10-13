export const HEALTH_RECORD_PATH='/api/v1/me/health-records/synthetic';
export function createHealthRecordClient({headers,available,onChange,request=fetch}){
  let records=[],status='EMPTY',revision=0,pending,controller;
  const notify=()=>onChange?.(records,status);
  return {
    records:()=>available()?records:[],status:()=>status,
    async load(){
      if(!available())return;
      if(pending)return pending;
      if(status==='READY')return;
      const generation=++revision;const activeController=controller=new AbortController();status='LOADING';notify();
      const deadline=setTimeout(()=>activeController.abort(),10000);
      pending=(async()=>{
        try{
          const auth=headers()?.authorization;if(!/^Bearer \S+$/u.test(auth??''))throw new Error('AUTH_REQUIRED');
          const response=await request(HEALTH_RECORD_PATH,{headers:{authorization:auth},signal:activeController.signal,cache:'no-store',redirect:'error'});
          const text=await response.text();if(text.length>65536)throw new Error('RECORDS_TOO_LARGE');
          const result=JSON.parse(text);
          if(!response.ok||result.synthetic!==true||result.clinicalUse!==false||!Array.isArray(result.records)||result.records.length>30||!result.records.every(r=>r.synthetic===true&&typeof r.id==='string'&&typeof r.date==='string'))throw new Error('RECORDS_UNAVAILABLE');
          if(generation!==revision||!available())return;
          records=result.records;status='READY';notify();
        }catch{if(generation===revision){records=[];status='ERROR';notify();}}
        finally{clearTimeout(deadline);if(generation===revision)pending=null;}
      })();
      return pending;
    },
    reset(){revision++;controller?.abort();pending=null;records=[];status='EMPTY';notify();},
  };
}
