import https from "node:https";
import { readFileSync } from "node:fs";
import { createCapstoneBPortal } from "../src/capstone-b-portal.js";
import { createCapstoneImageDecryptor } from "../src/capstone-encrypted-transfer.js";
import {createPatientImageDecryptor} from '../src/patient-encrypted-transfer.js';
import { boundedHttps } from "../src/data-plane-gateway.js";
import { hospitalKeyConfig } from "./capstone-hospital-key-config.js";
import { createRuntimeDiagnosticFactory } from "../src/capstone-runtime-diagnostics.js";
import { createBPacsReceiver, loadPinnedBImportManifest } from '../src/b-pacs-receiver.js';
const ca = readFileSync(process.env.CAPSTONE_B_CA_FILE);
const encryptionRequired = process.env.CAPSTONE_IMAGE_ENCRYPTION_REQUIRED === "1";
let imageDecryption;
let keyControl;
if (encryptionRequired) {
  const serviceToken = readFileSync(process.env.CAPSTONE_B_KEY_RELEASE_TOKEN_FILE, "utf8").trim();
  if (serviceToken.length < 32 || serviceToken.length > 256 || /[\r\n\0]/u.test(serviceToken)) throw new Error("B_KEY_RELEASE_CREDENTIAL_INVALID");
  const control = async (path, body) => {
    if (!["/gateway/data-plane/package/authorize", '/gateway/data-plane/package/import-authorize'].includes(path)) throw new Error("B_KEY_RELEASE_ROUTE_INVALID");
    const result = await boundedHttps("https://10.90.88.1", path, { tls: { ca }, method: "POST",
      headers: { "content-type": "application/json", "x-hipass-service-token": serviceToken },
      // Existing anti-abuse delay can reach 5s; retain it and give the strict
      // TLS metadata call finite headroom rather than racing that same deadline.
      body: JSON.stringify(body), maxBytes: 32768, timeoutMs: 8000 });
    return { status: result.status, body: JSON.parse(result.body.toString("utf8")) };
  };
  keyControl = control;
  imageDecryption = createCapstoneImageDecryptor({ ...hospitalKeyConfig("B"), control,
    publicBaseUrl: "https://192.168.111.149:9443", recipientHospitalId: "HOSP-B" });
}
let pacsReceiver;
if (process.env.CAPSTONE_B_PACS_IMPORT_ENABLED === '1') {
  if (!encryptionRequired || !keyControl) throw new Error('PACS_ENCRYPTION_REQUIRED');
  const pacsTls = { ca: readFileSync(process.env.CAPSTONE_B_PACS_CA_FILE),
    cert: readFileSync(process.env.CAPSTONE_B_PACS_CLIENT_CERT_FILE), key: readFileSync(process.env.CAPSTONE_B_PACS_CLIENT_KEY_FILE) };
  // B mTLS service validates its actual LUKS backing mount on every request.
  // Operator must separately verify the matching Orthanc/proxy bind sources.
  const pacs = (path, options) => boundedHttps('https://b-pacs-mtls:8443', path, {
    ...options, tls: pacsTls, timeoutMs: 4000,
    headers: { 'content-type': options.contentType ?? 'application/json' } });
  pacsReceiver = createBPacsReceiver({ lookupExpected: loadPinnedBImportManifest(process.env.CAPSTONE_B_PACS_MANIFEST_FILE), pacs,
    authorize: body => keyControl('/gateway/data-plane/package/import-authorize', body),
    assertStorageReady: async () => {
      const result = await pacs('/system', { method: 'GET', maxBytes: 32768 });
      if (result.status !== 200 || JSON.parse(result.body.toString('utf8')).Name !== 'Highpass B Synthetic Test PACS - Not For Clinical Use') throw new Error('PACS_DESTINATION_NOT_READY');
    } });
}
const patientSelfViewEnabled=process.env.CAPSTONE_PATIENT_SELF_VIEW_GATEWAY==='1';
let patientImageDecryption;
if(patientSelfViewEnabled && process.env.CAPSTONE_PATIENT_IMAGE_ENCRYPTION_REQUIRED==='1'){
  if(!encryptionRequired)throw new Error('PATIENT_ENCRYPTION_PROFILE_REQUIRED');
  const patientToken=readFileSync(process.env.CAPSTONE_B_PATIENT_KEY_RELEASE_TOKEN_FILE,'utf8').trim();
  const doctorToken=readFileSync(process.env.CAPSTONE_B_KEY_RELEASE_TOKEN_FILE,'utf8').trim();
  if(Buffer.byteLength(patientToken)<32 || patientToken.length>256 || /[\r\n\0]/.test(patientToken) || patientToken===doctorToken)throw new Error('PATIENT_B_CREDENTIAL_INVALID');
  const control=async(path,body)=>{
    if(path!=='/gateway/patient-self-view/package/authorize')throw new Error('PATIENT_B_ROUTE_INVALID');
    const result=await boundedHttps('https://10.90.88.1',path,{tls:{ca},method:'POST',headers:{'content-type':'application/json','x-hipass-service-token':patientToken},
      body:JSON.stringify(body),maxBytes:32768,timeoutMs:8000});return {status:result.status,body:JSON.parse(result.body.toString('utf8'))};
  };
  patientImageDecryption=createPatientImageDecryptor({...hospitalKeyConfig('B'),control,publicBaseUrl:'https://192.168.111.149:9443'});
}
const server = https.createServer({ cert: readFileSync(process.env.CAPSTONE_B_TLS_CERT_FILE), key: readFileSync(process.env.CAPSTONE_B_TLS_KEY_FILE), minVersion: "TLSv1.2" }, createCapstoneBPortal({ root: "/app/public", ca, encryptionRequired, imageDecryption,patientSelfViewEnabled,patientImageDecryption, pacsReceiver, diagnosticFactory: createRuntimeDiagnosticFactory(process.env) }));
server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.setTimeout(encryptionRequired ? 35000 : 20000, socket => socket.destroy());
server.listen(8443, "0.0.0.0");
