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
    parser = References()
    parser.feed((DOCS / 'index.html').read_text(encoding='utf8'))
    missing = []
    for reference in parser.references:
        parsed = urlsplit(reference)
        if not parsed.scheme and parsed.path and not (DOCS / unquote(parsed.path)).is_file():
            missing.append(reference)
    readme = (ROOT / 'README.md').read_text(encoding='utf8')
    for reference in re.findall(r'\]\(([^)]+)\)', readme):
        parsed = urlsplit(reference)
        if not parsed.scheme and parsed.path and not (ROOT / parsed.path).is_file():
            missing.append(reference)
    manifest = json.loads((DOCS / 'assets/portfolio-20261017/manifest.json').read_text(encoding='utf8'))
    mismatches = [row['file'] for row in manifest['images']
                  if hashlib.sha256((DOCS / 'assets/portfolio-20261017' / row['file']).read_bytes()).hexdigest() != row['sha256']]
    result = {'missingLocalLinks': missing, 'imageHashMismatches': mismatches,
              'images': len(manifest['images']), 'status': 'PASS' if not missing and not mismatches else 'FAIL'}
    print(json.dumps(result))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
