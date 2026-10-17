import test from 'node:test';
import assert from 'node:assert/strict';
import {publicHandoffReceipt,qrInputMeta} from '../src/public-qr-handoff.js';
import {patientRequestOrigin,PATIENT_APP_ORIGIN,PATIENT_IMAGE_ORIGIN} from '../src/patient-public-origins.js';
import {demoToolsModel,runDemoAction} from '../public/ui/demo-tools.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const env={AUTH_MODE:'ENTRA_OIDC',HIPASS_PATIENT_ISSUANCE_ORIGIN:PATIENT_APP_ORIGIN,HIPASS_PATIENT_IMAGE_ORIGIN:PATIENT_IMAGE_ORIGIN};
const principal={doctorId:'DOC-B-01',hospitalId:'HOSP-B'};
test('QR returns only original opaque path at approved application origin',()=>{
 const receipt={ticketId:'t',qr:{payload:'https://192.168.111.149:9443/t/'+'a'.repeat(43),expiresAt:'2030-01-01'}};
 const value=publicHandoffReceipt(receipt,env,'https://legacy.example');
 assert.equal(value.qr.payload,PATIENT_APP_ORIGIN+'/t/'+'a'.repeat(43));assert.equal(value.qr.expiresAt,receipt.qr.expiresAt);
 assert.notEqual(value,receipt);assert.throws(()=>publicHandoffReceipt({...receipt,qr:{payload:receipt.qr.payload+'?token=x'}},env,''));
 assert.equal(patientRequestOrigin('/api/demo/qr/redeem',env,'legacy'),PATIENT_APP_ORIGIN);
 assert.equal(patientRequestOrigin('/api/transfers/tickets/redeem-viewer',env,'legacy'),'legacy');
 assert.equal(patientRequestOrigin('/dicomweb/studies',env,'legacy'),'legacy');
});
test('demo input mode is fixed synthetic environment/doctor gated; no authority granted',()=>{
 const meta={ipAddress:'127.0.0.1',userAgent:'test'};
 assert.equal(qrInputMeta({inputMethod:'DEMO_IMPORT'},principal,meta,env).userAgent,'QR_INPUT:DEMO_IMPORT; test');
 for(const [p,e] of [[{},env],[{...principal,hospitalId:'HOSP-C'},env],[principal,{}],[principal,{...env,AUTH_MODE:'TEST'}]])assert.throws(()=>qrInputMeta({inputMethod:'DEMO_IMPORT'},p,meta,e));
 assert.throws(()=>qrInputMeta({inputMethod:'BYPASS'},principal,meta,env));
 assert.equal(qrInputMeta({},principal,meta,env).ipAddress,meta.ipAddress);
});
test('doctor can open input-only demo without patient role, ticket or selected consent',async()=>{
 const state={persona:'DOCTOR',roles:['DOCTOR'],environment:'PUBLIC'};
 assert.equal(demoToolsModel(state).items.find(x=>x.id==='simulate').enabled,true);
 let calls=0;assert.equal(await runDemoAction('simulate',{read:()=>state,confirm:async()=>true,execute:async()=>calls++}),true);assert.equal(calls,1);
 assert.equal(demoToolsModel({...state,roles:['PATIENT']}).items.some(x=>x.id==='simulate'),false);
});
test('shipped QR encoder pixels decode with shipped scanner to the same opaque public link',()=>{
 const context=vm.createContext({});
 vm.runInContext(readFileSync(new URL('../public/qrcode.js',import.meta.url),'utf8'),context);
 vm.runInContext(readFileSync(new URL('../public/jsqr.js',import.meta.url),'utf8'),context);
 const payload=PATIENT_APP_ORIGIN+'/t/'+'a'.repeat(43),qr=context.qrcode(0,'M');qr.addData(payload);qr.make();
 const count=qr.getModuleCount(),cell=6,margin=4,size=(count+margin*2)*cell,data=new Uint8ClampedArray(size*size*4).fill(255);
 for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))for(let dy=0;dy<cell;dy++)for(let dx=0;dx<cell;dx++){
   const at=(((y+margin)*cell+dy)*size+(x+margin)*cell+dx)*4;data[at]=data[at+1]=data[at+2]=0;
 }
 assert.equal(context.jsQR(data,size,size).data,payload);
});
