"""Run current bounded probe with secret-free stage diagnostics on pinned A."""
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('source_diagnosis', ROOT / 'scripts/hcc-source-diagnose-readonly.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
js = (ROOT / 'scripts/verify-hcc-source-gateway.js').read_text(encoding='utf8').replace("from '../", "from '/app/")
module.REMOTE = module.REMOTE.replace(module.IMAGE, 'sha256:50b1db9e1cdfdf71ac706cff09c3b11b0a0df1fd1b0ef1c66a1305c39aab43b8').replace(repr(module.JS), repr(js))
module.REMOTE = module.REMOTE.replace("for line in p.stdout.decode('utf8').splitlines()", "for line in (p.stdout+p.stderr).decode('utf8').splitlines()")
module.REMOTE = module.REMOTE.replace("rows[0]['gatewayRuntimeUnchanged']=True", "rows[0]['gatewayRuntimeUnchanged']=True; rows[0]['reportSubmitted']=rows[0].get('status')=='PASS'; rows[0]['catalogRegistered']=False")
# A probe can issue a challenge/report; never registers a catalog or grants access.
if __name__ == '__main__':
    # Rename the diagnostic scope: unlike QIDO-only diagnosis, this may persist a challenge/report.
    source = (ROOT / 'scripts/hcc-source-diagnose-readonly.py').read_text(encoding='utf8')
    source = source.replace('READ_ONLY_A_SOURCE_QIDO_INVENTORY_DIAGNOSIS', 'AUTHENTICATED_A_SOURCE_STAGE_PROBE')
    namespace = dict(module.__dict__)
    exec(compile(source, str(ROOT / 'scripts/hcc-source-diagnose-readonly.py'), 'exec'), namespace)
    namespace['REMOTE'] = module.REMOTE
    module.main = namespace['main']
    raise SystemExit(module.main())
