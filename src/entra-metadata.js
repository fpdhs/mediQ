import http from 'node:http';

const GUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const ENTRA_METADATA_ORIGIN='http://entra-metadata:8080';
export function metadataRoutes(tenant) {
  if(!GUID.test(tenant??''))throw new Error('ENTRA_METADATA_TENANT_REQUIRED');
  const root='https://login.microsoftonline.com/';
  return new Map([
    ['/discovery',root+tenant+'/v2.0/.well-known/openid-configuration'],
    ['/tenant-keys',root+tenant+'/discovery/v2.0/keys'],
    ['/common-keys',root+'common/discovery/v2.0/keys'],
  ]);
}

// Only public provider metadata may cross this dedicated internal network.
export function createEntraMetadataFetch(env, fetchImpl=globalThis.fetch) {
  if(!env.HIPASS_ENTRA_METADATA_ORIGIN)return fetchImpl;
  if(env.HIPASS_ENTRA_METADATA_ORIGIN!==ENTRA_METADATA_ORIGIN)throw new Error('ENTRA_METADATA_ORIGIN_INVALID');
  const routes=metadataRoutes(env.ENTRA_TENANT_ID);
  return (url,options={})=>{
    const route=[...routes].find(([,target])=>target===String(url))?.[0];
    if(!route || (options.method && options.method!=='GET') || options.body)throw new Error('ENTRA_METADATA_REQUEST_DENIED');
    return fetchImpl(ENTRA_METADATA_ORIGIN+route,{
      method:'GET',headers:{accept:'application/json'},redirect:'error',
      signal:options.signal??AbortSignal.timeout(5000),
    });
  };
}

export function createEntraMetadataServer({tenant,fetchImpl=globalThis.fetch}) {
  const routes=metadataRoutes(tenant);
  return http.createServer(async(req,res)=>{
    res.setHeader('cache-control','no-store');
    res.setHeader('content-type','application/json');
    const fail=(status,code)=>{res.writeHead(status);res.end(JSON.stringify({error:code}));};
    if(req.method!=='GET'||!routes.has(req.url)||req.headers.authorization||req.headers.cookie
      ||req.headers['transfer-encoding']||Number(req.headers['content-length']??0)!==0){
      req.resume();return fail(403,'METADATA_REQUEST_DENIED');
    }
    try{
      const response=await fetchImpl(routes.get(req.url),{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(4000)});
      if(!response.ok)throw new Error('UPSTREAM_UNAVAILABLE');
      const reader=response.body.getReader();let size=0;const chunks=[];
      try{
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw new Error('METADATA_TOO_LARGE');chunks.push(Buffer.from(value));}
      }finally{await reader.cancel().catch(()=>{});}
      const data=Buffer.concat(chunks);const parsed=JSON.parse(data.toString('utf8'));
      if(req.url==='/discovery'){
        if(parsed.issuer!==`https://login.microsoftonline.com/${tenant}/v2.0`
          ||![routes.get('/tenant-keys'),routes.get('/common-keys')].includes(parsed.jwks_uri))throw new Error('METADATA_INVALID');
      }else if(!Array.isArray(parsed.keys))throw new Error('METADATA_INVALID');
      res.writeHead(200);res.end(data);
    }catch{fail(503,'METADATA_UNAVAILABLE');}
  });
}
