"""Web-only, exact-context overlay onto captured Azure runtime. No API/auth changes."""
import difflib, importlib.util, pathlib, subprocess, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'scripts/qr-ticket-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
release.FOLDER = ROOT / 'artifacts/azure/viewer-access-polish-20261015'
release.REMOTE = '/opt/highpass/viewer-access-polish-20261015'
release.FILES = {'web': ['public/app.js', 'public/index.html', 'public/ui/viewer-studio.js',
                         'public/ui/viewer-studio.css', 'public/ui/brand.css',
                         'public/ui/patient-share-review.css', 'scripts/start-public-web.js']}
release.NEW = ['public/brand/mediq-dark.svg']

def patch(name, old):
    if name == 'scripts/start-public-web.js':
        return old
    before = subprocess.check_output(['git', 'show', 'HEAD:' + name], cwd=ROOT).decode('utf8').replace('\r\n', '\n')
    after = (ROOT / name).read_text(encoding='utf8').replace('\r\n', '\n')
    if name == 'public/app.js':
        for function in ['bindEvents', 'updateConsentOperationControls', 'requestDoctorToken', 'loadInstancesForSelectedSeries', 'renderSeries', 'startCountdownTimer']:
            def span(text, target):
                match = re.search(r'^(?:async )?function ' + target + r'\(', text, re.M)
                assert match, target
                end = re.search(r'^(?:async )?function \w+\(', text[match.end():], re.M)
                return match.start(), match.end() + end.start() if end else len(text)
            start, end = span(old, function)
            bs, be = span(before, function)
            ns, ne = span(after, function)
            if function == 'requestDoctorToken':
                ns = span(after, 'renewViewerAccess')[0]
            old = old[:start] + apply_groups(name + ':' + function, old[start:end], before[bs:be], after[ns:ne]) + old[end:]
        return old
    return apply_groups(name, old, before, after)

def apply_groups(name, old, before, after):
    a, b = before.splitlines(True), after.splitlines(True)
    groups = list(difflib.SequenceMatcher(None, a, b, autojunk=False).get_grouped_opcodes(1))
    if not groups:
        raise ValueError('No reviewed changes: ' + name)
    for group in groups:
        prior = ''.join(a[group[0][1]:group[-1][2]])
        updated = ''.join(b[group[0][3]:group[-1][4]])
        if old.count(prior) != 1:
            raise ValueError(f'Live context changed: {name}, baseline lines {group[0][1]+1}-{group[-1][2]}')
        old = release.previous.once(old, prior, updated)
    return old

release.patch = patch
original = release.previous.runtime.remote

def remote(client, role, password, source, timeout):
    source = source.replace("roles=['control','web'] if role=='CLOUD' else ['portal']", "roles=['web'] if role=='CLOUD' else ['portal']")
    source = source.replace('highpass-patient-viewer:', 'highpass-viewer-access-polish:')
    result = original(client, role, password, source, timeout)
    if 'main("CLOUD","capture"' in source:
        import json
        (release.FOLDER / 'capture-baseline.json').write_text(json.dumps(result))
    return result

release.previous.runtime.remote = remote
if __name__ == '__main__':
    release.main()
