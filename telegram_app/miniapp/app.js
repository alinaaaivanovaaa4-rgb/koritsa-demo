(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  let tg, inTelegram = false, bridgeConnected = false;
  const root = document.documentElement;
  const views = ['menu', 'choose', 'favorites', 'cafes'];
  const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 4.8a5.4 5.4 0 0 0-7.6 0L12 5.7l-.9-.9a5.4 5.4 0 0 0-7.6 7.6L12 21l8.5-8.6a5.4 5.4 0 0 0 0-7.6Z"/></svg>';
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  const cup = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 8h2a3 3 0 0 1 0 6h-2M3 22h16M8 2v2M12 2v2"/></svg>';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value).toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  const price = item => (Array.isArray(item.price) ? item.price.join(' / ') : item.price) + ' ₽';
  const plural = (number, words) => words[number % 100 >= 11 && number % 100 <= 14 ? 2 : number % 10 === 1 ? 0 : number % 10 >= 2 && number % 10 <= 4 ? 1 : 2];
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const saved = storage.get('koritsa-miniapp-favorites-v1', []);
  const favorites = new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
  let catalog, byId, toastTimer, activeView = 'menu', category = 'breakfast', query = '';
  let dish, photoIndex = 0, pickerMoment, pickerDirection = 'any', pickerFlavour = 'any', pickerStep = 'moment', pickerExtra = '';
  let selectedCafe = storage.get('koritsa-miniapp-cafe-v1', '');
  const start = new URLSearchParams(location.search);
  const dialog = $('#dish-dialog');

  function theme() {
    root.dataset.theme = tg?.colorScheme === 'dark' ? 'dark' : 'light';
    if (!inTelegram) return;
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    try { tg.setHeaderColor?.(bg); tg.setBackgroundColor?.(bg); tg.setBottomBarColor?.(bg); } catch { /* Older clients keep their native colors. */ }
  }
  function safeArea() {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const inset = Math.max(0, Number(tg?.safeAreaInset?.[side] || 0), Number(tg?.contentSafeAreaInset?.[side] || 0));
      root.style.setProperty('--safe-' + side, inset + 'px');
    }
  }
  function connectTelegram() {
    tg = window.Telegram?.WebApp;
    inTelegram = !!tg && tg.platform !== 'unknown';
    theme(); safeArea();
    if (!inTelegram || bridgeConnected) return;
    bridgeConnected = true;
    try {
      tg.ready(); tg.expand();
      tg.onEvent('themeChanged', theme);
      tg.onEvent('safeAreaChanged', safeArea);
      tg.onEvent('contentSafeAreaChanged', safeArea);
      tg.BackButton?.onClick(() => { if (dialog.open) closeDetail(); else if (activeView === 'choose' && pickerStep !== 'moment') pickerBack(); else go('menu'); });
      const launch = tg.initDataUnsafe?.start_param;
      if (catalog && !location.hash && !start.get('view') && views.includes(launch)) go(launch);
      if (catalog) syncRoute();
    } catch { /* Public catalog remains usable without the bridge. */ }
  }
  connectTelegram();
  $('#telegram-sdk')?.addEventListener('load', connectTelegram, {once:true});

  function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2600);
  }
  function go(view, item = '') {
    const params = new URLSearchParams({view});
    if (item) params.set('item', item);
    if (location.hash.slice(1) !== params.toString()) history.pushState({}, '', '#' + params.toString());
    syncRoute();
  }
  function syncRoute() {
    if (!catalog) return;
    const params = location.hash ? new URLSearchParams(location.hash.slice(1)) : start;
    const nextView = views.includes(params.get('view')) ? params.get('view') : 'menu';
    const viewChanged = nextView !== activeView;
    activeView = nextView;
    document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== activeView + '-view'; });
    document.querySelectorAll('.bottom-nav button').forEach(el => {
      if (el.dataset.view === activeView) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    if (activeView === 'menu') renderMenu();
    if (activeView === 'favorites') renderFavorites();
    if (activeView === 'choose') renderPicker();
    if (activeView === 'cafes') renderLocations();
    const item = byId.get(params.get('item'));
    if (item && !root.classList.contains('arrival-active')) openDetail(item);
    else if (dialog.open) { dialog.close(); dish = null; }
    if (inTelegram) {
      try { if (item || activeView !== 'menu') tg.BackButton?.show(); else tg.BackButton?.hide(); } catch {}
    }
    if (viewChanged) window.scrollTo({top:0, behavior:'instant'});
  }
  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('koritsa-arrival-closed', syncRoute);

  function favoriteButton(item) {
    const selected = favorites.has(item.id);
    return `<button class="icon-button favorite" data-favorite="${escape(item.id)}" aria-pressed="${selected}" aria-label="${selected ? 'Убрать из избранного' : 'В избранное'}: ${escape(item.title)}">${heart}</button>`;
  }
  function card(item, index = 9, row = false) {
    const image = item.thumbnail ? `<div class="card-photo"><img src="${escape(item.thumbnail)}" width="480" height="400" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async" alt="${escape(item.title)}"></div>` : '';
    const description = !item.thumbnail ? `<p class="card-summary">${escape(item.description || item.profile.summary || '')}</p>` : '';
    return `<article class="menu-card ${item.thumbnail ? (row ? 'photo-row' : '') : 'no-photo'}"><button class="dish-open" data-item="${escape(item.id)}" aria-label="${escape(item.title)}, ${escape(price(item))}. Подробнее">${image}<h3>${escape(item.title)}</h3>${description}<div class="card-meta"><strong>${escape(price(item))}</strong>${item.weight ? `<small>${escape(item.weight)} г</small>` : ''}</div></button>${favoriteButton(item)}</article>`;
  }
  function attachImageRecovery(container) {
    container.querySelectorAll('img').forEach(image => {
      image.addEventListener('error', () => {
        const fallback = document.createElement('span'); fallback.className = 'photo-fallback';
        fallback.setAttribute('role', 'img'); fallback.setAttribute('aria-label', 'Фото недоступно');
        fallback.innerHTML = cup; image.replaceWith(fallback);
      }, {once:true});
    });
  }
  function renderCards(container, items, grouped = false) {
    let previousGroup = null;
    const photos = items.filter(item => item.thumbnail);
    const ordered = [...photos, ...items.filter(item => !item.thumbnail)];
    container.innerHTML = ordered.map((item, index) => {
      const group = grouped && item.group && item.group !== previousGroup ? `<h3 class="menu-group">${escape(item.group)}</h3>` : '';
      previousGroup = item.group;
      return group + card(item, index, photos.length % 2 === 1 && index === photos.length - 1);
    }).join('');
    attachImageRecovery(container);
  }
  function renderMenu() {
    const focusedCategory = document.activeElement?.dataset?.category;
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const items = catalog.items.filter(item => (category === 'all' || item.category === category) &&
      terms.every(term => normalize([item.title, item.description, item.group, item.profile.summary].join(' ')).includes(term)));
    $('#categories').innerHTML = [{id:'all',title:'Всё'}, ...catalog.categories].map(cat =>
      `<button class="category-button" data-category="${escape(cat.id)}" aria-pressed="${cat.id === category}">${escape(cat.title)}</button>`).join('');
    $('#list-title').textContent = query ? 'Нашлось в меню' : catalog.categories.find(cat => cat.id === category)?.title || 'Всё меню';
    $('#results-count').textContent = `${items.length} из ${catalog.items.length}`;
    $('#total-count').textContent = `${catalog.items.length} ${plural(catalog.items.length, ['позиция','позиции','позиций'])}`;
    $('#search-empty').hidden = items.length > 0;
    $('#clear-search').hidden = !query;
    renderCards($('#menu-list'), items, !query);
    if (focusedCategory) $('#categories').querySelector(`[data-category="${focusedCategory}"]`)?.focus({preventScroll:true});
  }
  function updateFavoriteButtons() {
    document.querySelectorAll('[data-favorite]').forEach(button => {
      const item = byId.get(button.dataset.favorite);
      if (!item) return;
      const selected = favorites.has(item.id);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Убрать из избранного' : 'В избранное'}: ${item.title}`);
    });
    $('#favorite-badge').textContent = favorites.size;
    $('#favorite-badge').hidden = !favorites.size;
    if (dish) {
      $('#dish-favorite').setAttribute('aria-pressed', String(favorites.has(dish.id)));
      $('#dish-favorite').setAttribute('aria-label', favorites.has(dish.id) ? 'Убрать из избранного' : 'Добавить в избранное');
    }
  }
  function toggleFavorite(id) {
    if (!byId.has(id)) return;
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    const persisted = storage.set('koritsa-miniapp-favorites-v1', [...favorites]);
    updateFavoriteButtons();
    if (activeView === 'favorites') renderFavorites();
    notify(persisted ? (favorites.has(id) ? 'Сохранено в избранное' : 'Удалено из избранного') : 'Сохранено до закрытия приложения: хранилище недоступно');
    if (inTelegram) { try { tg.HapticFeedback?.selectionChanged(); } catch {} }
  }
  function renderFavorites() {
    const items = catalog.items.filter(item => favorites.has(item.id));
    $('#favorites-count').textContent = items.length ? `${items.length} в списке` : '';
    $('#favorites-empty').hidden = !!items.length;
    renderCards($('#favorites-list'), items);
  }

  function openDetail(item) {
    const changed = dish?.id !== item.id;
    dish = item;
    if (changed) photoIndex = 0;
    $('#dish-title').textContent = item.title;
    $('#dish-category').textContent = catalog.categories.find(cat => cat.id === item.category)?.title || '';
    $('#dish-price').textContent = price(item);
    $('#dish-weight').textContent = item.weight ? `${item.weight} г` : '';
    $('#dish-description').textContent = item.description || item.profile.summary || 'Подробности уточняйте в кофейне.';
    $('#price-note').hidden = !Array.isArray(item.price);
    $('#dish-favorite').innerHTML = heart;
    updateFavoriteButtons(); renderPhoto();
    if (!dialog.open) { dialog.showModal(); dialog.scrollTop = 0; }
  }
  function renderPhoto() {
    const focusedPhoto = document.activeElement?.dataset?.photo;
    $('#dish-photo').hidden = !dish.photos.length;
    if (!dish.photos.length) { $('#dish-photo').innerHTML = ''; return; }
    const controls = dish.photos.length > 1 ? `<div class="gallery-controls"><button class="icon-button" data-photo="-1" aria-label="Предыдущее фото"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg></button><span>${photoIndex + 1} / ${dish.photos.length}</span><button class="icon-button" data-photo="1" aria-label="Следующее фото">${arrow}</button></div>` : '';
    $('#dish-photo').innerHTML = `<img src="${escape(dish.photos[photoIndex])}" alt="${escape(dish.title)}, фото ${photoIndex + 1}" decoding="async">${controls}`;
    attachImageRecovery($('#dish-photo'));
    if (focusedPhoto) $('#dish-photo').querySelector(`[data-photo="${focusedPhoto}"]`)?.focus({preventScroll:true});
  }
  function closeDetail() {
    history.replaceState({}, '', '#view=' + activeView); syncRoute();
  }
  $('#close-dish').addEventListener('click', closeDetail);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  dialog.addEventListener('click', event => { if (event.target === dialog && event.clientY < dialog.getBoundingClientRect().top) closeDetail(); });
  $('#dish-favorite').addEventListener('click', () => { if (dish) toggleFavorite(dish.id); });
  $('#dish-cafes').addEventListener('click', () => go('cafes'));

  function pickerOptions(values, kind) {
    return values.map(value => `<button class="picker-option" data-${kind}="${escape(value.id)}"><span><strong>${escape(value.label)}</strong><small>${escape(value.hint)}</small></span><span class="option-count">${value.items.length} ${plural(value.items.length,['вариант','варианта','вариантов'])} ${arrow}</span></button>`).join('');
  }
  function pickerBack() {
    pickerExtra = '';
    if (pickerStep === 'results') pickerStep = 'flavour';
    else if (pickerStep === 'flavour') pickerStep = 'direction';
    else { pickerStep = 'moment'; pickerMoment = null; }
    renderPicker(); focusPicker();
  }
  function focusPicker() {
    $('#picker h2')?.focus({preventScroll:true});
    $('#choose-title').scrollIntoView({block:'start',behavior:'auto'});
  }
  function renderPicker() {
    const container = $('#picker');
    if (!pickerMoment || pickerStep === 'moment') {
      container.innerHTML = '<h2 tabindex="-1">Какую паузу устроим?</h2><p class="picker-progress">Вопрос 1 из 3 · выберите повод</p><div class="picker-moments">' + catalog.moments.map(moment =>
        `<button class="moment-button" data-moment="${escape(moment.id)}"><strong>${escape(moment.label)}</strong><span>${escape(moment.hint)}</span>${arrow}</button>`).join('') + '</div>';
      return;
    }
    const node = catalog.pickerTree[pickerMoment.id];
    const direction = node.directions.find(value => value.id === pickerDirection) || node.directions[0];
    const flavour = direction.flavours.find(value => value.id === pickerFlavour) || direction.flavours[0];
    const back = '<button class="text-button" data-picker-back>← Назад</button>';
    if (pickerStep === 'direction') {
      container.innerHTML = `${back}<h2 class="picker-title" tabindex="-1">${escape(pickerMoment.question)}</h2><p class="picker-progress">Вопрос 2 из 3 · ${escape(pickerMoment.label)}</p><div class="picker-options">${pickerOptions(node.directions,'direction')}</div>`;
      return;
    }
    if (pickerStep === 'flavour') {
      container.innerHTML = `${back}<h2 class="picker-title" tabindex="-1">Какой вкус ближе?</h2><p class="picker-progress">Вопрос 3 из 3 · ${escape(direction.label)}</p><p class="picker-explanation">Здесь только вкусы, подходящие к вашему выбору.</p><div class="picker-options">${pickerOptions(direction.flavours,'flavour')}</div>`;
      return;
    }
    const items = flavour.items.map(id => byId.get(id)).filter(Boolean);
    const summary = [pickerMoment.label, direction.id !== 'any' ? direction.label : '', flavour.id !== 'any' ? flavour.label : ''].filter(Boolean).join(' · ');
    const extraButtons = [pickerMoment.category !== 'desserts' ? '<button class="choice-chip" data-picker-extra="sweet">Добавить сладкое</button>' : '', pickerMoment.category !== 'drinks' ? '<button class="choice-chip" data-picker-extra="drink">Добавить напиток</button>' : ''].join('');
    container.innerHTML = `${back}<div class="picker-result-heading"><h2 tabindex="-1">${escape(pickerMoment.resultLabel)}</h2><span>${items.length} ${plural(items.length,['вариант','варианта','вариантов'])}</span></div><p class="picker-summary">${escape(summary)}</p><div class="menu-grid" id="picker-cards"></div><p class="allergy-note">Подбор учитывает вкус, но не исключает аллергены. При аллергии уточните полный состав у сотрудника кофейни.</p>${extraButtons ? `<h3 class="picker-title">Дополнить вашу паузу?</h3><div class="picker-chips">${extraButtons}</div>` : ''}<div id="picker-extras"></div><div class="picker-actions"><button class="text-button" data-picker-reset>Начать заново</button><button class="text-button" data-picker-category="${escape(pickerMoment.category)}">Вся категория ${arrow}</button></div>`;
    renderCards($('#picker-cards'), items);
    if (pickerExtra) {
      const extraMoment = catalog.moments.find(moment => moment.id === pickerExtra);
      const extras = catalog.pickerTree[extraMoment.id].directions[0].flavours[0].items.slice(0,3).map(id => byId.get(id));
      $('#picker-extras').innerHTML = `<h2 tabindex="-1">${pickerExtra === 'sweet' ? 'Сладкое к вашему блюду' : 'Напиток к вашей паузе'}</h2><p class="picker-explanation">Это отдельное дополнение. Основной выбор сохранён.</p><div class="menu-grid" id="extra-cards"></div>`;
      renderCards($('#extra-cards'), extras);
    }
  }
  function renderLocations() {
    const focusedCafe = document.activeElement?.dataset?.cafe;
    $('#locations').innerHTML = catalog.locations.map(location => {
      const selected = selectedCafe === location.id;
      return `<article class="location"><div class="location-top"><h2>${escape(location.address)}</h2><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></div><p>Прохладный</p><div class="location-actions"><a class="text-button" href="${escape(location.route)}" target="_blank" rel="noopener noreferrer" data-external>Маршрут ${arrow}</a><button class="text-button" data-cafe="${escape(location.id)}" aria-pressed="${selected}">${selected ? 'Выбрана' : 'Выбрать'}</button></div>${selected ? '<p class="selected-cafe">Ваша кофейня · адрес сохранён на этом устройстве</p>' : ''}</article>`;
    }).join('');
    if (focusedCafe) $('#locations').querySelector(`[data-cafe="${focusedCafe}"]`)?.focus({preventScroll:true});
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.view) go(button.dataset.view);
    if (button?.dataset.item) go(activeView, button.dataset.item);
    if (button?.dataset.favorite) toggleFavorite(button.dataset.favorite);
    if (button?.dataset.category) { category = button.dataset.category; renderMenu(); }
    if (button?.dataset.photo && dish) { photoIndex = (photoIndex + Number(button.dataset.photo) + dish.photos.length) % dish.photos.length; renderPhoto(); }
    if (button?.dataset.moment) {
      pickerMoment = catalog.moments.find(moment => moment.id === button.dataset.moment);
      pickerDirection = pickerFlavour = 'any'; pickerStep = 'direction'; pickerExtra = ''; renderPicker(); focusPicker();
    }
    if (button?.dataset.direction) { pickerDirection = button.dataset.direction; pickerFlavour = 'any'; pickerStep = 'flavour'; pickerExtra = ''; renderPicker(); focusPicker(); }
    if (button?.dataset.flavour) { pickerFlavour = button.dataset.flavour; pickerStep = 'results'; pickerExtra = ''; renderPicker(); focusPicker(); }
    if (button?.hasAttribute('data-picker-back')) pickerBack();
    if (button?.hasAttribute('data-picker-reset')) { pickerMoment = null; pickerStep = 'moment'; pickerExtra = ''; renderPicker(); focusPicker(); }
    if (button?.dataset.pickerExtra) {
      pickerExtra = button.dataset.pickerExtra; renderPicker(); $('#picker-extras h2')?.focus({preventScroll:true}); $('#picker-extras').scrollIntoView({block:'start',behavior:'auto'});
    }
    if (button?.dataset.pickerCategory) { category = button.dataset.pickerCategory; query = ''; $('#search-input').value = ''; go('menu'); }
    if (button?.dataset.cafe) {
      selectedCafe = button.dataset.cafe;
      const persisted = storage.set('koritsa-miniapp-cafe-v1', selectedCafe);
      renderLocations(); notify(persisted ? 'Адрес кофейни сохранён' : 'Адрес выбран до закрытия приложения');
    }
    const external = event.target.closest('a[data-external]');
    if (external && inTelegram && typeof tg.openLink === 'function') {
      event.preventDefault(); tg.openLink(external.href);
    }
  });
  $('#search-form').addEventListener('submit', event => { event.preventDefault(); $('#search-input').blur(); });
  $('#search-input').addEventListener('input', event => { query = event.target.value; if (query) category = 'all'; renderMenu(); });
  $('#clear-search').addEventListener('click', () => { query = ''; $('#search-input').value = ''; renderMenu(); $('#search-input').focus(); });
  $('#reset-filters').addEventListener('click', () => { category = 'all'; query = ''; $('#search-input').value = ''; renderMenu(); });

  async function load() {
    const loader = $('#load-state');
    loader.innerHTML = '<p>Собираем меню…</p><span>Кофе, еда и ваша пауза.</span>';
    loader.hidden = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('catalog.json', {cache:'no-cache', signal:controller.signal});
      if (!response.ok) throw new Error('catalog');
      const data = await response.json();
      if (!Array.isArray(data.items) || !Array.isArray(data.categories) || !data.items.length) throw new Error('catalog');
      catalog = data; byId = new Map(catalog.items.map(item => [item.id, item]));
      for (const id of favorites) if (!byId.has(id)) favorites.delete(id);
      if (!catalog.locations.some(location => location.id === selectedCafe)) selectedCafe = '';
      query = (start.get('q') || '').slice(0,120); $('#search-input').value = query;
      if (query) category = 'all';
      const launch = tg?.initDataUnsafe?.start_param || start.get('tgWebAppStartParam');
      // Only a navigation hint; identity and privileges never use initDataUnsafe.
      if (!start.get('view') && views.includes(launch)) start.set('view', launch);
      loader.hidden = true; updateFavoriteButtons(); syncRoute();
      window.__koritsaMiniArrival?.ready();
    } catch {
      window.__koritsaMiniArrival?.error();
      loader.innerHTML = '<p>Меню не загрузилось</p><span>Проверьте соединение и попробуйте ещё раз.</span><button class="primary-button" id="retry-load">Попробовать снова</button>';
      $('#retry-load').addEventListener('click', load, {once:true});
    } finally {
      clearTimeout(timeout);
    }
  }
  load();
})();
