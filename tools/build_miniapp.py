#!/usr/bin/env python3
"""Build the Telegram catalog from the website's single menu source."""
import hashlib
import json
import shutil
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'koritsa_studio'
APP = SITE / 'miniapp'
DIST = ROOT / 'telegram_bot' / 'dist'


def main():
    data = json.loads((SITE / 'data.json').read_text())
    picker = json.loads((SITE / 'recommendations.json').read_text())
    media = json.loads((SITE / 'assets/provenance.json').read_text())
    items = []
    assets = {'assets/fonts/onest-variable.woff2', 'assets/fonts/OFL.txt',
              'assets/brand/wordmark-olive.svg', 'assets/brand/mark-olive.svg',
              'assets/intro/coffee-bean.webp', 'assets/intro/plates/shrimp-orzo-cutout.webp',
              'assets/intro/plates/cherry-syrniki-cutout.webp'}
    for item in data['items']:
        gallery = item.get('gallery', [])
        if not gallery and item.get('image'):
            variants = sorted((p for p in media if p.get('dish') == item['image']), key=lambda p: p['width'])
            if variants:
                best = next((p for p in variants if p['width'] >= 960), variants[-1])
                gallery = [{'src': 'assets/' + best['file'], 'srcset': ', '.join(
                    f"assets/{p['file']} {p['width']}w" for p in variants)}]
        photos = []
        thumb = None
        for photo in gallery:
            candidates = [(int(part.strip().split()[1][:-1]), part.strip().split()[0])
                          for part in photo.get('srcset', '').split(',') if part.strip()]
            small = min(candidates)[1] if candidates else photo['src']
            large = photo['src']
            assets.update((small, large))
            photos.append('../' + large)
            if thumb is None:
                thumb = '../' + small
        items.append({key: item.get(key) for key in ('id', 'category', 'title', 'price', 'weight', 'description', 'group')} |
                     {'thumbnail': thumb, 'photos': photos, 'profile': picker['profiles'][item['id']]})
    tree = {}
    routes = 0
    for moment in picker['moments']:
        pool = [item for item in items if item['category'] == moment['category']]
        if not pool:
            raise ValueError(f'Picker category is empty: {moment["id"]}')
        directions = []
        for direction in [{'id': 'any', 'label': 'Доверюсь вам', 'hint': 'Все варианты этой категории.'}, *moment['directions']]:
            candidates = [item for item in pool if direction['id'] == 'any' or direction['id'] in item['profile']['directions']]
            if not candidates:
                continue
            flavours = []
            for flavour in [{'id': 'any', 'label': 'Показать все подходящие', 'hint': 'Сохраним ваш основной выбор.'}, *moment['flavours']]:
                if direction['id'] != 'any' and flavour.get('when') and direction['id'] not in flavour['when']:
                    continue
                matched = [item for item in candidates if flavour['id'] == 'any' or flavour['id'] in item['profile']['flavours']]
                if not matched:
                    continue
                matched.sort(key=lambda item: moment['featured'].index(item['id']) if item['id'] in moment['featured'] else 999)
                hint = flavour.get('hint', '') if flavour['id'] == 'any' else ', '.join(item['title'] for item in matched[:2])
                flavours.append({'id': flavour['id'], 'label': flavour['label'], 'hint': hint,
                                 'items': [item['id'] for item in matched]})
                routes += 1
            directions.append({'id': direction['id'], 'label': direction['label'], 'hint': direction.get('hint', ''),
                               'items': [item['id'] for item in candidates], 'flavours': flavours})
        tree[moment['id']] = {'directions': directions}
    version = hashlib.sha256(((SITE / 'data.json').read_bytes() +
                              (SITE / 'recommendations.json').read_bytes() + b'picker-flow-v2')).hexdigest()[:12]
    details_path = SITE / 'cafe-details.json'
    details = json.loads(details_path.read_text()) if details_path.exists() else {}
    locations = []
    for location in data['locations']:
        extra = details.get(location['id'], {})
        public = dict(location)
        for key in ('hoursLabel', 'phone', 'features'):
            if extra.get(key):
                public[key] = extra[key]
        if extra.get('photo'):
            relative = extra['photo']
            if not isinstance(relative, str) or not relative.startswith('assets/'):
                raise ValueError('Cafe photo must be a local asset')
            assets.add(relative)
            public['photo'] = '../' + relative
        locations.append(public)
    payload = {'version': version, 'categories': data['categories'], 'items': items,
               'locations': locations, 'moments': picker['moments'], 'pickerTree': tree}
    APP.mkdir(exist_ok=True)
    (APP / 'catalog.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    index = (APP / 'index.html').read_text()
    for filename in ['app.css', 'app.js', 'search.js', 'arrival.css', 'arrival.js']:
        digest = hashlib.sha256((APP / filename).read_bytes()).hexdigest()[:12]
        index = re.sub(r'((?:src|href)=")' + re.escape(filename) + r'(?:\?v=[^\"]*)?"',
                       lambda match: match[1] + filename + '?v=' + digest + '"', index)
    (APP / 'index.html').write_text(index)
    static = []
    for category in data['categories']:
        static.append(f'<h2 class="picker-title">{escape(category["title"])}</h2>')
        for item in items:
            if item['category'] != category['id']:
                continue
            cost = ' / '.join(map(str, item['price'])) if isinstance(item['price'], list) else str(item['price'])
            weight = f' · {item["weight"]} г' if item['weight'] else ''
            static.append(f'<article class="location"><h3>{escape(item["title"])}</h3>'
                          f'<p>{escape(cost)} ₽{escape(weight)}</p><p>{escape(item["description"] or "")}</p></article>')
    (APP / 'menu.html').write_text('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Корица — меню</title>'
        '<link rel="stylesheet" href="app.css"></head><body><main class="app-shell">'
        '<a class="text-button" href="index.html">Открыть приложение →</a><h1>Меню «Корицы»</h1>' + ''.join(static) +
        '<p class="catalog-note">Наличие и полный состав уточняйте в кофейне.</p></main></body></html>')
    # The distributable contains only public UI files and the assets this app uses.
    DIST.mkdir(parents=True, exist_ok=True)
    for folder in ('miniapp', 'assets'):
        if (DIST / folder).exists():
            shutil.rmtree(DIST / folder)
    shutil.copytree(APP, DIST / 'miniapp')
    for relative in sorted(assets):
        source = (SITE / relative).resolve()
        if not source.is_relative_to((SITE / 'assets').resolve()) or not source.is_file():
            raise ValueError(f'Invalid Mini App asset: {relative}')
        target = DIST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    (DIST / 'index.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8">'
                                  '<meta http-equiv="refresh" content="0;url=miniapp/">'
                                  '<title>Корица — меню</title><a href="miniapp/">Открыть меню «Корицы»</a></html>')
    (DIST / '.nojekyll').touch()
    print(f'Telegram Mini App: {len(items)} items, {len(data["locations"])} cafes, {routes} nonempty picker routes, '
          f'{len(assets)} local assets; {DIST}')


if __name__ == '__main__':
    main()
