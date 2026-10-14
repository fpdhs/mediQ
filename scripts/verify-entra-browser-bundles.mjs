// Bind minified browser dependencies to the exact candidate bytes; never rewrite UI.
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const folder=path.resolve(process.argv[2]??'');
if(!folder.startsWith(path.join(root,'artifacts','azure')+path.sep))throw new Error('ARTIFACT_PATH_REQUIRED');
const candidate=JSON.parse(readFileSync(path.join(folder,'candidate.json'),'utf8')).roles.portal;
const components=new Map(),checks=[];
for(const [entry,name] of [['src/entra-browser-client-entry.js','msal-browser.js'],['src/entra-redirect-entry.js','entra-redirect.js']]){
 const result=await build({absWorkingDir:root,entryPoints:[entry],outfile:path.join(root,'public','vendor',name),bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'none',sourcemap:false,metafile:true,write:false});
 const hash=createHash('sha256').update(result.outputFiles[0].contents).digest('hex');
 checks.push({file:name,sha256:hash,status:hash===candidate.hashes['public/vendor/'+name]?'PASS':'FAIL'});
 for(const input of Object.keys(result.metafile.inputs)){
  const pos=input.lastIndexOf('node_modules/');if(pos<0)continue;
  const relative=input.slice(pos+'node_modules/'.length).split('/');const count=relative[0].startsWith('@')?2:1;
  const directory=path.resolve(root,input.slice(0,pos)+'node_modules/'+relative.slice(0,count).join('/'));
  const pkg=JSON.parse(readFileSync(path.join(directory,'package.json'),'utf8'));
  components.set(pkg.name,{type:'library',name:pkg.name,version:pkg.version,licenses:[{license:{id:pkg.license}}]});
 }
}
const output={status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',review:'DRAFT / UNASSIGNED',image:candidate.image,checks,components:[...components.values()],lockSha256:createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex')};
writeFileSync(path.join(folder,'browser-bundle-provenance.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output));if(output.status!=='PASS')process.exitCode=1;
