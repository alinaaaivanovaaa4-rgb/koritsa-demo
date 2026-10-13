#!/usr/bin/env python3
"""Build and validate the current studio site for GitHub Pages."""
import re
import runpy
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'koritsa_studio'
OUTPUT = ROOT / '_site'


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'href', 'poster'):
            if attrs.get(key):
                self.urls.append(attrs[key])
        if attrs.get('srcset'):
            self.urls.extend(part.strip().split()[0] for part in attrs['srcset'].split(','))


def check_reference(source, url):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or not parts.path:
        return
    if parts.path.startswith('/'):
        raise ValueError(f'{source.name}: root-relative URL breaks project Pages: {url}')
    target = (source.parent / unquote(parts.path)).resolve()
    if not target.is_relative_to(OUTPUT.resolve()) or not target.is_file():
        raise ValueError(f'{source.name}: missing or invalid local resource: {url}')


def main():
    runpy.run_path(str(ROOT / 'tools/build_studio.py'), run_name='__main__')
    runpy.run_path(str(ROOT / 'tools/build_miniapp.py'), run_name='__main__')
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for name in ('index.html', 'menu.html', 'choose.html'):
        shutil.copy2(SITE / name, OUTPUT / name)
    for pattern in ('*.css', '*.js'):
        for source in SITE.glob(pattern):
            shutil.copy2(source, OUTPUT / source.name)
    shutil.copytree(SITE / 'miniapp', OUTPUT / 'miniapp')
    shutil.copytree(SITE / 'assets', OUTPUT / 'assets', ignore=shutil.ignore_patterns(
        'provenance.json', 'README.md', 'prompt.txt', '*.prompt.txt', '.DS_Store'))
    (OUTPUT / '.nojekyll').touch()

    references = 0
    for source in OUTPUT.rglob('*.html'):
        parser = References()
        parser.feed(source.read_text())
        for url in parser.urls:
            check_reference(source, url)
            references += 1
    for source in OUTPUT.rglob('*.css'):
        for url in re.findall(r'url\(\s*[\"\']?([^\"\')]+)[\"\']?\s*\)', source.read_text()):
            check_reference(source, url.strip())
            references += 1
    files = [p for p in OUTPUT.rglob('*') if p.is_file()]
    size = sum(p.stat().st_size for p in files) / (1024 * 1024)
    print(f'Pages artifact: {len(files)} files, {size:.1f} MiB, {references} references checked; output: {OUTPUT}')


if __name__ == '__main__':
    main()
