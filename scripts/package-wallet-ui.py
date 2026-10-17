"""Lossless packaging/crop of Blender render passes, with reproducible provenance."""
from pathlib import Path
from PIL import Image
import hashlib, json

root = Path(__file__).resolve().parents[1]
source = root / 'assets/wallet-3d/ui-v1'
target = root / 'public/images'
files = {}
for layer in ('back', 'front'):
    image = Image.open(source / (layer + '.png')).convert('RGBA')
    assert image.size == (1800, 1100)
    for mobile in (False, True):
        # The same mesh and camera, right leaf only. No texture stretch/repainting.
        result = image.crop((900, 0, 1800, 1100)) if mobile else image
        name = 'mediq-wallet-model-' + ('mobile-' if mobile else '') + layer + '.webp'
        path = target / name
        if path.exists():
            raise RuntimeError('Do not overwrite an existing render: ' + name)
        result.save(path, 'WEBP', lossless=True, exact=True, method=6)
        assert path.stat().st_size < 2097152
        assert Image.open(path).convert('RGBA').tobytes() == result.tobytes()
        files[name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                       'bytes': path.stat().st_size, 'width': result.width, 'height': result.height}
manifest = {'review': 'DRAFT / UNASSIGNED', 'sourceModel': 'assets/wallet-3d/v3/mediq-wallet.blend',
            'modelSha256': hashlib.sha256((root/'assets/wallet-3d/v3/mediq-wallet.blend').read_bytes()).hexdigest(),
            'renderScript': 'scripts/render-wallet-ui.py', 'encoding': 'lossless WebP',
            'mobile': 'right leaf crop, same camera and mesh', 'files': files}
(source/'web-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
print(json.dumps(manifest, indent=2))
