"""Keep health records bound to the receptionist's explicitly selected consent."""
import importlib.util,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/qr-ticket-release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
release.FOLDER=ROOT/'artifacts/azure/clinician-flow-context-20261014';release.REMOTE='/opt/highpass/clinician-flow-context-20261014'
release.FILES={'web':['public/app.js','public/ui/clinician-health.js','scripts/start-public-web.js']};release.NEW=[]
def patch(name,old):
 once=release.previous.once
 if name=='scripts/start-public-web.js':return old
 if name=='public/app.js':return once(old,'    latestConsentId=receipt.consentId;','    latestConsentId=receipt.consentId;\n    clinicianHealth?.selectReception(receipt.consentId);')
 local=(ROOT/name).read_text(encoding='utf8')
 # Whole file equality gate on unchanged lines; only four documented statements differ.
 for needle in ["  let revision=", "      if(!Array.isArray(result.shares)","      if(!shares.length)","  return {setActive(value)"]:
  line=next(l for l in old.splitlines() if l.startswith(needle))
  target=next(l for l in local.splitlines() if l.startswith('  return {selectReception' if needle.startswith('  return') else needle))
  if needle=='  let revision=':target+='\n  let receptionConsent=null;'
  old=once(old,line,target)
 return old
release.patch=patch
original=release.previous.runtime.remote
def remote(client,role,password,source,timeout):return original(client,role,password,source.replace("roles=['control','web'] if role=='CLOUD' else ['portal']","roles=['web'] if role=='CLOUD' else ['portal']"),timeout)
release.previous.runtime.remote=remote
if __name__=='__main__':release.main()
