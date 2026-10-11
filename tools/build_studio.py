#!/usr/bin/env python3
"""Render the independent Koritsa studio candidate from its menu snapshot."""
import json
import os
from hashlib import sha256
from collections import Counter
from html import escape
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'koritsa_studio'
WORDMARK_VERSION = {color: sha256((SITE / 'assets/brand' / f'wordmark-{color}.svg').read_bytes()).hexdigest()[:12] for color in ('olive', 'cream')}
STYLE_VERSION = sha256((SITE / 'styles.css').read_bytes()).hexdigest()[:12]
INSTAGRAM_NOTICE = '* Instagram принадлежит компании Meta Platforms Inc., признанной экстремистской организацией, деятельность которой запрещена в РФ.'
SITE_URL = os.environ.get('SITE_URL', 'https://alinaaaivanovaaa4-rgb.github.io/koritsa-demo/').rstrip('/') + '/'
SHARE_IMAGE_VERSION = sha256((SITE / 'assets/social/koritsa-share.jpg').read_bytes()).hexdigest()[:12]
DATA = json.loads((SITE / 'data.json').read_text())
MEDIA = json.loads((SITE / 'assets/provenance.json').read_text())
ITEMS = {item['id']: item for item in DATA['items']}
PICKER = json.loads((SITE / 'recommendations.json').read_text())

INTRO_BOOT = '''<style>.site-intro{display:none}.intro-pending .site-intro{display:flex;position:fixed;inset:0;z-index:100;background:#fffef2}.intro-pending{overflow:hidden}</style>
  <script>(()=>{try{const preview=new URLSearchParams(location.search).get('intro')==='1';if(!preview&&sessionStorage.getItem('koritsa-arrival-v1'))return;window.__koritsaIntro={started:performance.now(),preview};document.documentElement.classList.add('intro-pending');window.__koritsaIntroFailSafe=setTimeout(()=>{if(window.__koritsaIntroRelease)window.__koritsaIntroRelease();else{document.documentElement.classList.remove('intro-pending');document.querySelector('.site-intro')?.remove()}},6500)}catch{}})();</script>
  <link rel="stylesheet" href="intro.css?v=20261011-plates"><script src="intro.js?v=20261011-plates" defer></script>'''


def arrival():
    return f'''<section class="site-intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
  <div class="intro-top"><img src="assets/brand/wordmark-olive.svg?v={WORDMARK_VERSION['olive']}" width="160" height="46" alt="Корица"><button class="intro-skip" type="button">Перейти на сайт {arrow()}</button></div>
  <div class="intro-composition">
    <div class="intro-copy"><h2 id="intro-title">Сейчас<br> будет<br><span>хорошо.</span></h2><p>Кофе, еда<br> и время для себя.</p></div>
    <div class="intro-scene" aria-hidden="true">
      <div class="intro-beans"></div>
      <img class="intro-dish intro-dish-savory" src="assets/intro/plates/shrimp-orzo-cutout.webp" width="768" height="512" alt="" loading="eager" fetchpriority="low">
      <img class="intro-dish intro-dish-sweet" src="assets/intro/plates/cherry-syrniki-cutout.webp" width="768" height="512" alt="" loading="eager" fetchpriority="low">
      <img class="intro-symbol" src="assets/brand/mark-olive.svg" width="132" height="128" alt="">
    </div>
  </div>
  <div class="intro-bottom"><span>кофе · еда · пауза</span><div class="intro-readiness"><span class="intro-status" role="status">Готовим первый кадр</span><span class="intro-track" aria-hidden="true"><span></span></span></div></div>
</section>'''


def validate_picker():
    profiles = PICKER['profiles']
    if set(profiles) != set(ITEMS):
        raise ValueError(f'Picker profiles differ from menu: missing={set(ITEMS) - set(profiles)}, extra={set(profiles) - set(ITEMS)}')
    moments = PICKER['moments']
    if len({m['id'] for m in moments}) != len(moments):
        raise ValueError('Duplicate picker moment IDs')
    if {m['category'] for m in moments} != {c['id'] for c in DATA['categories']}:
        raise ValueError('Picker must cover every menu category')
    for moment in moments:
        for field in ('directions', 'flavours'):
            ids = [choice['id'] for choice in moment[field]]
            if len(set(ids)) != len(ids) or 'any' in ids:
                raise ValueError(f'Invalid {field} in {moment["id"]}')
        direction_ids = {x['id'] for x in moment['directions']}
        flavour_ids = {x['id'] for x in moment['flavours']}
        for id in moment['featured']:
            if id not in ITEMS or ITEMS[id]['category'] != moment['category']:
                raise ValueError(f'Invalid featured item: {id}')
        for item in DATA['items']:
            if item['category'] != moment['category']:
                continue
            profile = profiles[item['id']]
            if not profile['directions'] or not profile['flavours'] or not profile['summary']:
                raise ValueError(f'Empty picker profile: {item["id"]}')
            if not set(profile['directions']) <= direction_ids or not set(profile['flavours']) <= flavour_ids:
                raise ValueError(f'Unknown picker tags: {item["id"]}')


def arrow(diagonal=False):
    path = 'M5 19 19 5M5 5h14v14' if diagonal else 'M4 12h16m-6-6 6 6-6 6'
    return f'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="{path}"/></svg>'


def photo(key, alt, sizes, eager=False, cls=''):
    variants = sorted((m for m in MEDIA if m.get('dish') == key), key=lambda m: m['width'])
    best = next((m for m in variants if m['width'] >= 960), variants[-1])
    srcset = ', '.join(f"assets/{m['file']} {m['width']}w" for m in variants)
    loading = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    return (f'<img class="{cls}" src="assets/{best["file"]}" srcset="{srcset}" '
            f'sizes="{sizes}" width="{best["width"]}" height="{best["height"]}" '
            f'alt="{escape(alt)}" {loading} decoding="async">')


def gallery_data():
    galleries = {}
    for item in DATA['items']:
        if not item.get('image'):
            continue
        photos = item.get('gallery')
        if not photos:
            variants = sorted((m for m in MEDIA if m.get('dish') == item['image']), key=lambda m: m['width'])
            best = next((m for m in variants if m['width'] >= 960), variants[-1])
            photos = [{'src': f'assets/{best["file"]}', 'srcset': ', '.join(f'assets/{m["file"]} {m["width"]}w' for m in variants), 'width': best['width'], 'height': best['height']}]
        galleries[item['id']] = {'title': item['title'], 'photos': photos}
    return json.dumps(galleries, ensure_ascii=False).replace('<', '\\u003c')


def price(item):
    value = item['price']
    label = ' / '.join(str(p) for p in value) if isinstance(value, list) else str(value)
    return f'{escape(label)} ₽'


def weight(item):
    return f'{item["weight"]} г' if item.get('weight') else ''


def header(menu=False, chooser=False):
    return f'''<a class="skip-link" href="#main">Перейти к содержимому</a>
<header class="site-header">
  <a class="brand" href="index.html" aria-label="Корица — главная">
    <img class="brand-mark" src="assets/brand/mark-olive.svg" width="42" height="42" alt="">
    <img class="brand-name" src="assets/brand/wordmark-olive.svg?v={WORDMARK_VERSION['olive']}" width="128" height="40" alt="Корица">
  </a>
  <span class="header-city">Кофейни в Прохладном</span>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Разделы<span class="menu-lines" aria-hidden="true"></span></button>
  <nav class="site-nav" id="site-nav" aria-label="Главная навигация">
    <a href="menu.html" {'aria-current="page"' if menu else ''}>Меню</a>
    <a href="choose.html" {'aria-current="page"' if chooser else ''}>Помочь выбрать</a>
    <a href="{'index.html' if menu or chooser else ''}#food">Наши блюда</a>
    <a href="{'index.html' if menu or chooser else ''}#locations">Кофейни {arrow(True)}</a>
  </nav>
</header>'''


def footer(menu=False):
    dock_main = f'<a href="index.html" class="dock-home">Главная {arrow()}</a>' if menu else f'<a href="menu.html">Смотреть меню {arrow()}</a>'
    return f'''<footer class="site-footer">
  <div class="footer-top"><p>кофе · еда · пауза</p><div class="footer-social"><a href="https://www.instagram.com/koritza_proh/" target="_blank" rel="noopener noreferrer" aria-describedby="footer-instagram-note"><span>Корица в Instagram<sup aria-hidden="true">*</sup></span> {arrow(True)}</a><p class="social-legal" id="footer-instagram-note">{INSTAGRAM_NOTICE}</p></div></div>
  <a class="footer-wordmark" href="index.html" aria-label="Корица — на главную"><img src="assets/brand/wordmark-cream.svg?v={WORDMARK_VERSION['cream']}" width="1080" height="300" alt="Корица" loading="lazy"></a>
  <div class="footer-bottom"><span>Прохладный</span><span>© Корица, 2026</span><a href="{'#main' if menu else '#top'}">Наверх {arrow()}</a></div>
</footer>
<nav class="mobile-dock" aria-label="Быстрые действия">{dock_main}<a href="index.html#locations">Кофейни {arrow(True)}</a></nav>'''


def document(title, body, menu=False, chooser=False):
    description = ('Меню «Корицы»: завтраки, салаты, горячие блюда, супы, десерты и напитки. Четыре кофейни в Прохладном.' if menu else
                   'Выберите блюдо по своему вкусу: ответьте на несколько вопросов и сравните подходящие варианты из меню «Корицы».' if chooser else
                   'Кофе, еда и маленькие паузы в Прохладном. Посмотрите меню «Корицы» и выберите блюдо по своему вкусу.')
    page_url = escape(urljoin(SITE_URL, 'menu.html' if menu else 'choose.html' if chooser else ''), quote=True)
    image_url = escape(urljoin(SITE_URL, f'assets/social/koritsa-share.jpg?v={SHARE_IMAGE_VERSION}'), quote=True)
    return f'''<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#FFFEF2"><meta name="description" content="{description}">
  <title>{title}</title>
  <meta property="og:title" content="{title}"><meta property="og:description" content="{description}">
  <link rel="canonical" href="{page_url}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Корица"><meta property="og:locale" content="ru_RU">
  <meta property="og:url" content="{page_url}"><meta property="og:image" content="{image_url}"><meta property="og:image:secure_url" content="{image_url}">
  <meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Логотип «Корица», кофе, еда и маленькие паузы в Прохладном, блюда за общим столом">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}"><meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image_url}"><meta name="twitter:image:alt" content="Корица — кофе, еда и маленькие паузы в Прохладном">
  <link rel="preload" href="assets/fonts/onest-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="icon" href="assets/brand/mark-olive.svg" type="image/svg+xml">
  {INTRO_BOOT if not menu and not chooser else ''}
  <link rel="stylesheet" href="styles.css?v={STYLE_VERSION}"><script src="app.js?v=20261011-dishes" defer></script>
  {'<link rel="stylesheet" href="photo-gallery.css?v=20261011-autoplay"><script src="photo-gallery.js?v=20261011-autoplay" defer></script>' if menu or chooser else ''}
  {'<link rel="stylesheet" href="picker.css?v=20261011-edge-photo"><script src="picker-core.js" defer></script><script src="picker.js?v=20261011-edge-photo" defer></script>' if chooser else ''}
</head>
<body class="{'choose-page' if chooser else 'menu-page' if menu else 'home-page'}" id="top">
{arrival() if not menu and not chooser else ''}
{header(menu, chooser)}
{body}
{footer(menu)}
{f'<script type="application/json" id="photo-gallery-data">{gallery_data()}</script>' if menu or chooser else ''}
</body>
</html>'''


def home():
    shared = photo('shared-table', 'Шесть салатов «Корицы» за общим столом', '(min-width: 1440px) 1344px, 94vw', True)
    mobile_variants = sorted((m for m in MEDIA if m.get('dish') == 'shared-table-mobile'), key=lambda m: m['width'])
    mobile_srcset = ', '.join(f"assets/{m['file']} {m['width']}w" for m in mobile_variants)
    hero_picture = f'<picture><source media="(max-width: 767px)" srcset="{mobile_srcset}" sizes="92vw" width="960" height="1440">{shared}</picture>'
    chapters = [
        {'title': 'Утро можно<br>не торопить.', 'label': 'На завтрак', 'name': 'Завтраки', 'choices': [
            ('turkish-breakfast', 'breakfast-scene'),
            ('english-breakfast', 'english-scene'),
            ('cherry-syrniki', 'syrniki-scene'),
        ]},
        {'title': 'Повод остаться<br>на обед.', 'label': 'На обед', 'name': 'Горячие блюда', 'choices': [
            ('almond-salmon', 'salmon-catalog'),
            ('shrimp-orzo', 'gallery-shrimp-orzo-alimpro-1208'),
            ('seafood-spaghetti', 'gallery-seafood-spaghetti-alimpro-1233'),
            ('chicken-sweet-potato', 'gallery-chicken-sweet-potato-alimpro-1161'),
            ('chicken-curry', 'gallery-chicken-curry-alimpro-1136'),
            ('chicken-roast', 'gallery-chicken-roast-alimpro-1187'),
        ]},
        {'title': 'Чего-нибудь<br>свежего.', 'label': 'Полегче', 'name': 'Салаты', 'choices': [
            ('shrimp-avocado', 'gallery-shrimp-avocado-alimpro-1016'),
            ('chicken-nut-salad', 'gallery-chicken-nut-salad-alimpro-1066'),
            ('crispy-eggplant', 'gallery-crispy-eggplant-alimpro-1047'),
            ('chicken-stracciatella', 'gallery-chicken-stracciatella-alimpro-1064'),
            ('green-salad', 'gallery-green-salad-alimpro-1008'),
            ('greek-salad', 'gallery-greek-salad-alimpro-1109'),
        ]},
        {'title': 'И немного<br>сладкого.', 'label': 'Сладкая пауза', 'name': 'Сладкая пауза', 'choices': [
            ('cherry-syrniki', 'syrniki-scene'),
        ]},
    ]
    slides = ''
    chapter_html = ''
    for i, chapter in enumerate(chapters):
        desktop_photos, mobile_photos, dishes = '', '', ''
        for j, (id, k) in enumerate(chapter['choices']):
            item = ITEMS[id]
            image = photo(k, item['title'], '(min-width: 1440px) 700px, 52vw').replace('<img ', '<img draggable="false" ')
            mobile_image = photo(k, item['title'], '(max-width: 767px) 92vw, 60vw').replace('<img ', '<img draggable="false" ')
            hidden = ' hidden' if j else ''
            desktop_photos += f'<figure class="story-dish" data-dish-photo="{j}"{hidden}>{image}<figcaption>{escape(item["title"])}<span>{price(item)}</span></figcaption></figure>'
            mobile_photos += f'<div class="chapter-photo" data-dish-photo="{j}"{hidden}>{mobile_image}</div>'
            inactive = ' aria-hidden="true" inert' if j else ''
            dishes += f'''<div class="chapter-dish {'is-active' if j == 0 else ''}" data-dish="{j}" data-dish-title="{escape(item['title'])}"{inactive}>
              <p>{escape(item.get('description') or '')}</p>
              <div class="dish-meta"><span>{escape(item['title'])}</span><span>{price(item)} · {weight(item)}</span></div>
              <a class="text-link" href="menu.html?category={item['category']}#menu-{id}">Посмотреть в меню {arrow()}</a>
            </div>'''
        slides += f'<div class="story-slide {"is-active" if i == 0 else ""}" data-slide="{i}" data-dish-swipe="{i}">{desktop_photos}</div>'
        controls = ''
        if len(chapter['choices']) > 1:
            controls = f'''<div class="dish-browse" aria-label="Перелистывать: {chapter['name']}">
              <span class="dish-count" aria-hidden="true"><span data-dish-number>1</span><span> / {len(chapter['choices'])}</span></span>
              <div class="dish-browse-buttons"><button class="dish-arrow dish-arrow-prev" type="button" data-dish-step="-1" aria-label="Предыдущее блюдо: {chapter['name']}">{arrow()}</button><button class="dish-arrow" type="button" data-dish-step="1" aria-label="Следующее блюдо: {chapter['name']}">{arrow()}</button></div>
              <span class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-dish-status></span>
            </div>'''
        carousel = f' role="region" aria-roledescription="карусель" aria-label="{chapter["name"]}"' if len(chapter['choices']) > 1 else ''
        chapter_html += f'''<article class="food-chapter" id="story-{i}" data-chapter="{i}"{carousel}>
          <div class="chapter-mobile-photo" data-dish-swipe="{i}">{mobile_photos}</div>
          <div class="chapter-copy"><h3>{chapter['title']}</h3><div class="chapter-dishes">{dishes}</div>{controls}</div>
        </article>'''
    counts = Counter(x['category'] for x in DATA['items'])
    category_links = ''.join(f'<a href="menu.html?category={c["id"]}" class="index-row"><span>{c["title"]}</span><small>{counts[c["id"]]} поз.</small>{arrow()}</a>' for c in DATA['categories'])
    routes = ''.join(f'<a class="location-row" href="{x["route"]}" target="_blank" rel="noopener noreferrer"><span class="location-address">{x["address"]}</span><span class="route-label">Маршрут {arrow(True)}</span></a>' for x in DATA['locations'])
    pause_photo = photo('syrniki-detail', 'Вишнёвое конфи и греческий йогурт на сырниках «Корицы»', '(min-width: 1000px) 440px, 70vw')
    body = f'''<main id="main">
  <section class="hero wrap" aria-labelledby="hero-title">
    <div class="hero-heading"><div class="hero-intro"><h1 id="hero-title">Хорошо быть здесь.</h1><p class="hero-promise"><strong>Кофе, еда и маленькие паузы</strong><span>в Прохладном.</span></p></div><div class="hero-actions"><a class="primary-link" href="menu.html">Смотреть меню<span>{arrow()}</span></a><a class="hero-picker-link" href="choose.html">Помогите выбрать {arrow()}</a></div></div>
    <div class="hero-subline"><a href="#locations">Найти свою «Корицу» {arrow(True)}</a></div>
    <div class="hero-photo">{hero_picture}</div>
    <div class="hero-caption"><p>За одним столом<br>всегда есть место хорошему.</p><p>Завтрак перед делами. Обед без спешки.<br>Встреча, которую давно откладывали.</p><a class="round-link" href="#food" aria-label="Перейти к историям блюд">{arrow()}</a></div>
  </section>
  <section class="food-stories wrap" id="food" aria-labelledby="food-title">
    <div class="section-heading"><h2 id="food-title"><span class="food-title-line">Каждому моменту —</span><br>свой вкус.</h2><p>От завтрака до сладкой паузы.<br>Выбирайте своё.</p></div>
    <div class="stories-layout"><div class="story-stage"><div class="story-slides" aria-hidden="true">{slides}</div><nav class="story-tabs" aria-label="Истории блюд">{''.join(f'<a href="#story-{i}" class="{"is-active" if i==0 else ""}" data-story-link="{i}">{x["label"]}</a>' for i,x in enumerate(chapters))}</nav></div><div class="chapters">{chapter_html}</div></div>
  </section>
  <section class="menu-index" aria-labelledby="menu-index-title"><div class="wrap menu-index-layout">
    <div class="menu-index-intro"><h2 id="menu-index-title">Что вам<br>сегодня?</h2><p>От первого кофе<br>до любимого десерта.</p><a class="text-link" href="menu.html">Всё меню {arrow()}</a><img class="index-mark" src="assets/brand/mark-cream.svg" width="100" height="100" alt="" loading="lazy"></div>
    <div class="menu-index-list">{category_links}</div>
  </div></section>
  <section class="pause wrap" id="pause" aria-labelledby="pause-title">
    <div class="pause-word"><h2 id="pause-title">пауза.</h2><img src="assets/brand/mark-olive.svg" width="88" height="88" alt="" loading="lazy"></div>
    <div class="pause-layout">
      <div class="pause-copy"><h3>Время вместе.<br>И для себя.</h3><p>Иногда лучший план — отложить дела, выбрать что-нибудь вкусное и просто побыть здесь.</p><a class="text-link" href="https://www.instagram.com/koritza_proh/" target="_blank" rel="noopener noreferrer" aria-describedby="pause-instagram-note"><span>Истории «Корицы» в Instagram<sup aria-hidden="true">*</sup></span> {arrow(True)}</a><p class="social-legal" id="pause-instagram-note">{INSTAGRAM_NOTICE}</p></div>
      <div class="pause-photo">{pause_photo}</div>
    </div>
  </section>
  <section class="locations" id="locations" aria-labelledby="locations-title"><div class="wrap"><div class="section-heading"><h2 id="locations-title">Увидимся<br>в «Корице».</h2><p>Четыре адреса в Прохладном.<br>Выбирайте, куда удобнее зайти.</p></div><div class="location-list">{routes}</div><p class="map-note">Маршруты откроются в Яндекс Картах.</p></div></section>
</main>'''
    (SITE / 'index.html').write_text(document('Корица — кофе, еда, пауза · Прохладный', body))


def menu():
    sections = ''
    for category in DATA['categories']:
        rows = ''
        last_group = None
        for item in DATA['items']:
            if item['category'] != category['id']:
                continue
            if item.get('group') and item['group'] != last_group:
                rows += f'<h3 class="menu-group" data-group="{escape(item["group"])}">{escape(item["group"])}</h3>'
                last_group = item['group']
            image = photo(item['image'], item['title'], '(max-width: 767px) 88px, 112px', cls='menu-thumb') if item.get('image') else ''
            if image:
                count = len(item.get('gallery') or [item['image']])
                image = f'<button type="button" class="menu-photo-open" data-gallery-open="{escape(item["id"])}" aria-label="Открыть фотографии: {escape(item["title"])}">{image}<span class="menu-photo-count" aria-hidden="true">{count} фото</span></button>'
            desc = escape(item.get('description') or '')
            search = escape(' '.join([item['title'], item.get('description') or '', item.get('group') or '', category['title']]).lower())
            if desc:
                content = f'<details><summary>Состав <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><p>{desc}</p></details>'
            else:
                content = ''
            rows += f'''<article class="menu-item {'has-photo' if image else ''}" id="menu-{item['id']}" data-category="{category['id']}" data-search="{search}" tabindex="-1">{image}<div class="item-copy"><div class="item-heading"><h3>{escape(item['title'])}</h3><span class="item-price">{price(item)}</span></div>{f'<span class="item-weight">{weight(item)}</span>' if weight(item) else ''}{content}</div></article>'''
        sections += f'<section class="menu-category" id="category-{category["id"]}" data-category-section="{category["id"]}" aria-labelledby="title-{category["id"]}"><h2 id="title-{category["id"]}">{category["title"]}</h2>{rows}</section>'
    cats = '<a class="category-button is-active" href="#menu-results" data-category-filter="all" aria-current="true">Всё меню<span>64</span></a>'
    counts = Counter(x['category'] for x in DATA['items'])
    cats += ''.join(f'<a class="category-button" href="#category-{c["id"]}" data-category-filter="{c["id"]}">{c["title"]}<span>{counts[c["id"]]}</span></a>' for c in DATA['categories'])
    body = f'''<main id="main" class="wrap menu-main">
<div class="menu-page-heading"><h1>Меню «Корицы».</h1><a class="text-link" href="index.html#locations">Выбрать кофейню {arrow(True)}</a></div>
<div class="menu-lead"><p>Найти любимое.<br>И попробовать что-нибудь новое.</p><form class="menu-search" role="search"><label for="menu-query" class="sr-only">Поиск по всем блюдам и напиткам</label><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="menu-query" type="search" placeholder="Блюдо или ингредиент" autocomplete="off"><button type="button" class="search-clear" hidden aria-label="Очистить поиск"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></form></div>
<aside class="menu-picker-invite" aria-label="Подбор по вкусу"><div><p>Трудно выбрать?</p><span>Пара ответов — и несколько идей из меню.</span></div><a class="primary-link" href="choose.html">Помочь выбрать<span>{arrow()}</span></a></aside>
<div class="menu-workspace"><nav class="category-nav" aria-label="Категории меню">{cats}<p class="menu-data-note">Цены — в рублях.<br>Вес — в граммах.</p></nav><div class="menu-results" id="menu-results"><p class="results-status" role="status" aria-live="polite">64 позиции в меню</p><div class="empty-state" hidden><h2>Ничего не нашлось.</h2><p>Попробуйте другое название или ингредиент.</p><button class="primary-link reset-search" type="button">Показать всё меню<span>{arrow()}</span></button></div>{sections}<p class="drinks-note">Для напитков с двумя ценами уточняйте вариант у бариста.</p></div></div>
</main>'''
    (SITE / 'menu.html').write_text(document('Меню — Корица · Прохладный', body, True))


def chooser():
    validate_picker()
    payload_items = []
    for item in DATA['items']:
        entry = {**item, **PICKER['profiles'][item['id']]}
        entry.pop('gallery', None)
        if item.get('image'):
            variants = sorted((m for m in MEDIA if m.get('dish') == item['image']), key=lambda m: m['width'])
            if not variants:
                raise ValueError(f'Missing picker photo for {item["id"]}')
            best = next((m for m in variants if m['width'] >= 960), variants[-1])
            entry['photo'] = {'src': f'assets/{best["file"]}', 'srcset': ', '.join(f'assets/{m["file"]} {m["width"]}w' for m in variants), 'width': best['width'], 'height': best['height']}
        payload_items.append(entry)
    payload = json.dumps({'moments': PICKER['moments'], 'items': payload_items}, ensure_ascii=False).replace('<', '\\u003c')
    body = f'''<main id="main" class="wrap picker-main">
  <div class="picker-heading"><h1>Корица <span>· подбор по вкусу</span></h1><a class="picker-full-menu" href="menu.html">Всё меню {arrow()}</a></div>
  <div class="picker-layout">
    <div class="picker-workspace">
      <div id="picker-stage"><div class="picker-fallback"><h2>Всё начинается<br>с вашего вкуса.</h2><p>Подбор загружается. Полное меню всегда рядом.</p><a class="text-link" href="menu.html">Открыть меню {arrow()}</a></div></div>
      <noscript><p class="picker-noscript">Для интерактивного подбора включите JavaScript или выберите блюдо в <a href="menu.html">полном меню</a>.</p></noscript>
      <p id="picker-message" class="picker-message" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>
  </div>
  <div id="picker-comparison-bar" class="picker-comparison-bar" hidden><div class="wrap"><p id="picker-comparison-count">Выбрано 0 из 2</p><button type="button" class="picker-clear" data-action="clear-comparison">Очистить</button><button type="button" class="picker-solid-button" data-action="open-comparison" disabled>Сравнить два {arrow()}</button></div></div>
  <dialog id="picker-comparison" class="picker-dialog" aria-labelledby="picker-comparison-title"><div class="picker-dialog-heading"><h2 id="picker-comparison-title">Две идеи рядом.</h2><button type="button" class="picker-dialog-close" aria-label="Закрыть сравнение"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><div id="picker-comparison-content" class="picker-comparison-grid"></div><p class="picker-availability">Наличие блюд и варианты напитков уточняйте в кофейне.</p></dialog>
  <script type="application/json" id="picker-data">{payload}</script>
</main>'''
    (SITE / 'choose.html').write_text(document('Что сегодня по вкусу — Корица · Прохладный', body, chooser=True))


if __name__ == '__main__':
    validate_picker()
    home()
    menu()
    chooser()
    print(f'Studio candidate: 3 pages, {len(DATA["items"])} menu items, {len(DATA["locations"])} routes, picker profiles validated.')
