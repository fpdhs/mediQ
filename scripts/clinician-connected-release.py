"""Reviewed Cloud reception UI + scoped record/issuance routes; no raw images."""
import importlib.util,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/qr-ticket-release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
release.FOLDER=ROOT/'artifacts/azure/clinician-connected-20261014';release.REMOTE='/opt/highpass/clinician-connected-20261014'
release.FILES={'control':['src/server.js','src/services.js','src/postgres-store.js','src/shared-health-records.js','src/data-plane-authorization.js'],
 'web':['public/app.js','public/ui/clinician-reception.js','public/ui/clinician-reception.css','scripts/start-public-web.js']};release.NEW=[]
def patch(name,old):
 local=(ROOT/name).read_text(encoding='utf8');once=release.previous.once;fn=release.previous.function
 if name in ['public/ui/clinician-reception.js','public/ui/clinician-reception.css']:return local
 if name=='src/shared-health-records.js':
  if not old:return local
  old=once(old,"import {sendJson} from './http-utils.js';","import {sendJson} from './http-utils.js';\nimport {Role} from './domain.js';")
  assert old.count("d.roles?.includes('DOCTOR')")==2
  return old.replace("d.roles?.includes('DOCTOR')","d.roles?.includes(Role.DOCTOR)")
 if name=='src/data-plane-authorization.js':
  old=once(old,'route = parseDataPlaneRequest(input, configuration.publicBaseUrl);','route = parseDataPlaneRequest(input, dataPlaneProofOrigin(input, configuration));')
  a='// URI selection is NOT authorization:';b='export async function revalidateDataPlaneReceipt('
  return once(old,b,fn(local,a,b)+b)
 if name=='src/server.js':
  if 'createSharedHealthHandler' not in old:
   old=once(old,"import {clinicianReceptions} from './clinician-receptions.js';","import {clinicianReceptions} from './clinician-receptions.js';\nimport {createSharedHealthHandler} from './shared-health-records.js';")
   a='const routeSharedHealth=';b='const routePatientGrant =';old=once(old,b,fn(local,a,b)+b)
   anchor='  if (await routeSyntheticHealth(request,response,url)) return;';old=once(old,anchor,anchor+'\n  if (await routeSharedHealth(request,response,url)) return;')
  a='    const result = await operation(service,';b='    response.setHeader("cache-control", "no-store");'
  start=old.index(a);end=old.index(b,start);block=old[start:end]
  return once(old,block,once(block,'      publicBaseUrl: process.env.HIPASS_DATA_PLANE_PUBLIC_BASE_URL,',"      publicBaseUrl: process.env.HIPASS_DATA_PLANE_PUBLIC_BASE_URL,\n      clinicianPublicBaseUrl: process.env.AUTH_MODE==='ENTRA_OIDC'?process.env.HIPASS_PATIENT_IMAGE_ORIGIN:undefined,"))
 if name=='src/services.js':
  old=once(old,'import {',"import {validateHealthRecordSelection,healthRecordScope} from './shared-health-records.js';\nimport {") if old.count('import {')==1 else "import {validateHealthRecordSelection,healthRecordScope} from './shared-health-records.js';\n"+old
  return once(old,fn(old,'  async createConsent(input)', '  getConsent(consentId)'),fn(local,'  async createConsent(input)', '  getConsent(consentId)'))
 if name=='src/postgres-store.js':
  # Only reviewed scope persistence additions; preserve other live migrations.
  old=once(old,fn(old,'  async insertConsents(rows)', '  async insertConsentScopes(rows)'),fn(local,'  async insertConsents(rows)', '  async insertConsentScopes(rows)'))
  old=once(old,'  consents: (row) => ({\n    consentId: row.consent_id,','  consents: (row) => ({\n    consentId: row.consent_id,\n    healthRecordScope: row.health_record_scope ?? null,')
  # Nullable additive schema on the existing store migration path.
  return old+'\n' if 'health_record_scope jsonb' in old else once(old,'CREATE TABLE IF NOT EXISTS consent_scopes', 'ALTER TABLE consents ADD COLUMN IF NOT EXISTS health_record_scope jsonb;\n\nCREATE TABLE IF NOT EXISTS consent_scopes')
 if name=='scripts/start-public-web.js':return once(old,'const routes=[',"const routes=[\n ['GET',/^\\/api\\/v1\\/clinician\\/health-records$/],\n ['POST',/^\\/api\\/dicom-access\\/request$/],")
 if name=='public/app.js':
  for a,b in [('let receptionDesk=null;','let receptionDesk=null;\nlet receptionHome=null;'),('  receptionDesk?.clear();','  receptionDesk?.clear();\n  receptionHome?.reset();'),('initializeReceptionHome(document.querySelector(\'.share-reception\'),()=>currentPersona===\'DOCTOR\');','receptionHome=initializeReceptionHome(document.querySelector(\'.share-reception\'),()=>currentPersona===\'DOCTOR\');')]:old=once(old,a,b)
  old=once(old,fn(old,'async function openViewer()', 'async function loadGatewayStudies()'),fn(local,'async function openViewer()', 'async function loadGatewayStudies()'))
  a='  if(location.hostname===\'highpass-demo.japaneast.cloudapp.azure.com\'&&currentPersona===\'DOCTOR\'){';b='  const auditParams = new URLSearchParams();'
  old=once(old,b,fn(local,a,b)+b)
  for a,b in [('async function proofFetch(','function developmentPrincipalHeaders('),('async function redeemScannedNonce(','async function simulateQrScan()')]:old=once(old,fn(old,a,b),fn(local,a,b))
  a='receptionDesk=createReceptionDesk(';start=old.index(a);end=old.index('\n});',start)+4
  localstart=local.index('async function selectReceptionContext(');localend=local.index('\n});',local.index(a))+4
  return once(old,old[start:end],local[localstart:localend])
 raise ValueError(name)
release.patch=patch
original=release.previous.runtime.remote
def remote(client,role,password,source,timeout):
 result=original(client,role,password,source,timeout)
 if 'main("CLOUD","capture",' in source:
  for part,info in result.items():
   for name,value in info['files'].items():
    if value is None:
     assert name=='src/shared-health-records.js';info['files'][name]=''
 return result
release.previous.runtime.remote=remote
if __name__=='__main__':release.main()
