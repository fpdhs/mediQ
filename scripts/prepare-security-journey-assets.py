"""Encode original generated illustrations without cropping or altering artwork."""
import hashlib,json,pathlib
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=json.loads((ROOT/'scripts/security-journey-assets.json').read_text(encoding='utf8'))
target=ROOT/'public/assets/security-journey'
target.mkdir(parents=True,exist_ok=True)
manifest={'review':'DRAFT / UNASSIGNED','tool':spec['tool'],'assets':[]}
for item in spec['assets']:
    source=pathlib.Path(item['source']);dest=target/(item['key']+'-v1.webp')
    if dest.exists():raise RuntimeError('ASSET_ALREADY_EXISTS: '+dest.name)
    with Image.open(source) as image:
        assert image.size==(1536,1024)
        image.save(dest,'WEBP',quality=92,method=6)
    manifest['assets'].append(dict(name=dest.name,width=1536,height=1024,bytes=dest.stat().st_size,
        sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),prompt=item['prompt']))
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'count':len(manifest['assets']),'bytes':sum(a['bytes'] for a in manifest['assets'])}))
