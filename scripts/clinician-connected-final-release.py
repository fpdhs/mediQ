"""Web-only guarded dashboard branch after regression verification."""
import importlib.util,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/qr-ticket-release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
release.FOLDER=ROOT/'artifacts/azure/clinician-connected-final-20261014';release.REMOTE='/opt/highpass/clinician-connected-final-20261014'
release.FILES={'web':['public/app.js','scripts/start-public-web.js']};release.NEW=[]
def patch(name,old):
 if name=='scripts/start-public-web.js':return old
 base=(ROOT/'artifacts/azure/clinician-connected-20261014'/name).read_text(encoding='utf-8');assert old==base,'APP_BASELINE_CHANGED'
 return (ROOT/name).read_text(encoding='utf-8')
release.patch=patch
original=release.previous.runtime.remote
def remote(client,role,password,source,timeout):return original(client,role,password,source.replace("roles=['control','web'] if role=='CLOUD' else ['portal']","roles=['web'] if role=='CLOUD' else ['portal']"),timeout)
release.previous.runtime.remote=remote
if __name__=='__main__':release.main()
