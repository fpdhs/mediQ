"""Validate local publication links and unchanged evidence bytes."""
import hashlib
import json
import pathlib
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        self.references.extend(value for key, value in attrs if key in ('src', 'href') and value)


def main():
    missing = []
    surfaces = ['index.html', 'presentation/gallery.html', 'presentation/project.html']
    for surface in surfaces:
        parser = References()
        page = DOCS / surface
        parser.feed(page.read_text(encoding='utf8'))
        for reference in parser.references:
            parsed = urlsplit(reference)
            if not parsed.scheme and parsed.path:
                target = page.parent / unquote(parsed.path)
                if not target.is_file() and not (target.is_dir() and (target / 'index.html').is_file()):
                    missing.append(f'{surface}: {reference}')
    readme = (ROOT / 'README.md').read_text(encoding='utf8')
    for reference in re.findall(r'\]\(([^)]+)\)', readme):
        parsed = urlsplit(reference)
        if not parsed.scheme and parsed.path and not (ROOT / parsed.path).is_file():
            missing.append(reference)
    manifest = json.loads((DOCS / 'assets/portfolio-20261017/manifest.json').read_text(encoding='utf8'))
    mismatches = [row['file'] for row in manifest['images']
                  if hashlib.sha256((DOCS / 'assets/portfolio-20261017' / row['file']).read_bytes()).hexdigest() != row['sha256']]
    gallery = (DOCS / 'presentation/gallery.html').read_text(encoding='utf8')
    gallery_mismatches = [row['file'] for row in manifest['images']
                          if f'data-image="{row["file"]}"' not in gallery]
    stale_gallery = 'screenshots/' in gallery or '24종' in gallery
    archives = list((DOCS / 'design/archive/mockups').rglob('*.html'))
    unmarked = [str(p.relative_to(DOCS)) for p in archives
                if '과거 개발 시안입니다.' not in p.read_text(encoding='utf8')]
    result = {'missingLocalLinks': missing, 'imageHashMismatches': mismatches,
              'galleryMissingImages': gallery_mismatches, 'staleGallery': stale_gallery,
              'unmarkedArchivePages': unmarked, 'publicSurfaces': len(surfaces),
              'archivePages': len(archives), 'images': len(manifest['images']),
              'status': 'PASS' if not any([missing, mismatches, gallery_mismatches, stale_gallery, unmarked]) else 'FAIL'}
    print(json.dumps(result))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
