import {createEntraMetadataServer} from '../src/entra-metadata.js';
const server=createEntraMetadataServer({tenant:process.env.ENTRA_TENANT_ID});
server.requestTimeout=6000;server.headersTimeout=6000;server.keepAliveTimeout=1000;
server.listen(8080,'0.0.0.0');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>process.exit(0)));
