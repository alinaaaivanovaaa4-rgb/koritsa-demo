(() => {
  'use strict';
  const source = document.getElementById('picker-data');
  if (!source || !window.KoritsaPicker) return;
  const data = JSON.parse(source.textContent);
  const core = window.KoritsaPicker;
  const main = document.querySelector('.picker-main');
  const stage = document.getElementById('picker-stage');
  const message = document.getElementById('picker-message');
  const bar = document.getElementById('picker-comparison-bar');
  const dialog = document.getElementById('picker-comparison');
  const comparison = document.getElementById('picker-comparison-content');
  const selected = new Set();
  let offset = 0;
  let revealAnimations = [];
  let revealRevision = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const keys = ['moment', 'direction', 'flavour'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
  const down = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const undo = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5"/></svg>';
  const momentLabels = {breakfast: 'Завтрак', meal: 'Обед или ужин', fresh: 'Свежий салат', soup: 'Горячий суп', sweet: 'Что-то сладкое', drink: 'Напиток'};
  const momentHints = {breakfast: 'Сырники, каша или целый завтрак.', meal: 'Паста, курица или рыба.', fresh: 'Овощи, зелень и любимые добавки.', soup: 'Куриный, чечевичный или Том Ям.', sweet: 'Вафли, блинчики или чизкейк.', drink: 'Кофе, чай или холодный напиток.'};
  const symbols = {
    breakfast: '<circle cx="24" cy="24" r="9"/><path d="M24 6v5m0 26v5M6 24h5m26 0h5M11 11l4 4m18 18 4 4m0-26-4 4M15 33l-4 4"/>',
    meal: '<path d="M9 30a15 15 0 0 1 30 0M6 34h36M24 11v4m-3-4h6M15 40h18"/>',
    salad: '<path d="M11 35C6 16 22 8 39 9c0 17-7 32-24 29M10 40l22-22m-13 7v9m7-16h9"/>',
    soup: '<path d="M8 25h32c-1 10-7 15-16 15S9 35 8 25m4 18h24M17 7c-6 5 5 6 0 11m8-13c-6 5 5 6 0 11m8-9c-6 5 5 6 0 11"/>',
    sweet: '<path d="M10 23h28v17H10Zm0 8c5-6 8 6 14 0s9 5 14-1M8 23h32M16 23v-8m8 8v-8m8 8v-8M16 7v2m8-2v2m8-2v2"/>',
    drink: '<path d="M10 20h24v9c0 8-4 12-12 12s-12-4-12-12v-9Zm24 2h4c8 0 6 10-4 10M8 44h28M16 6c-5 4 5 5 0 9m9-9c-5 4 5 5 0 9"/>',
    seafood: '<path d="M9 24c8-14 18-14 27 0-9 14-19 14-27 0Zm27 0 8-9v18l-8-9M23 15v18"/><circle cx="15" cy="23" r="1"/>',
    creamy: '<path d="M24 7c-6 9-13 15-13 22a13 13 0 0 0 26 0c0-7-7-13-13-22Zm-6 22c0 5 3 7 6 7"/>',
    expressive: '<path d="M25 6c4 13-11 13-5 23 3-1 6-5 7-9 9 7 12 12 8 18-6 10-23 7-24-5-1-10 7-12 14-27Z"/>',
    any: '<circle cx="24" cy="24" r="15"/><path d="M15 27c0-12 18-12 18-1 0 9-12 10-12 3 0-4 5-5 7-2"/>',
  };
  const optionSymbol = (question, option) => {
    const aliases = {vegetables:'salad', fresh:'salad', chicken:'meal', savory:'meal', coffee:'drink', tea:'drink', warm:'drink', cold:'drink', fruit:'salad', cheese:'creamy', milk:'creamy', crispy:'breakfast', tomato:'soup', nuts:'sweet', icecream:'sweet'};
    const key = symbols[option.id] ? option.id : aliases[option.id] || (question.key === 'direction' ? answers.moment : 'any');
    return `<span class="picker-option-symbol" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none">${symbols[key] || symbols.any}</svg></span>`;
  };
  const readAddress = () => core.normalize(data, Object.fromEntries(new URLSearchParams(location.search)));
  let answers = readAddress();

  const countLabel = number => {
    const last = number % 10, lastTwo = number % 100;
    return `${number} ${last === 1 && lastTwo !== 11 ? 'вариант' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'варианта' : 'вариантов'}`;
  };
  const price = item => `${(Array.isArray(item.price) ? item.price : [item.price]).map(escape).join(' / ')} ₽`;
  const menuLink = item => `menu.html?category=${encodeURIComponent(item.category)}#menu-${encodeURIComponent(item.id)}`;
  const meta = item => `<div class="picker-result-price"><strong>${price(item)}</strong>${item.weight ? `<span>${escape(item.weight)} г</span>` : ''}</div>`;
  const visual = (item, compare = false) => item.photo
    ? window.KoritsaPhotoGallery.markup(item.id, 'picker-result-visual', compare ? '(max-width: 767px) 85vw, 420px' : '(max-width: 767px) 90vw, 700px')
    : `<div class="picker-result-visual is-type" aria-hidden="true"><span>${escape(item.title)}</span><img src="assets/brand/mark-cream.svg" width="56" height="56" alt=""></div>`;
  const composition = item => item.description
    ? `<details><summary>Состав по меню ${down}</summary><p>${escape(item.description)}</p></details>`
    : '<p class="picker-result-recipe">Состав уточняйте у бариста.</p>';

  const trail = () => {
    const current = core.moment(data, answers.moment);
    const entries = [
      { key: 'moment', label: momentLabels[current?.id] || current?.label },
      { key: 'direction', label: answers.direction !== 'any' && core.directions(data, answers).find(choice => choice.id === answers.direction)?.label },
      { key: 'flavour', label: answers.flavour !== 'any' && core.flavours(data, answers).find(choice => choice.id === answers.flavour)?.label }
    ].filter(entry => entry.label);
    return entries.length ? `<div class="picker-trail" aria-label="Ваши ответы">${entries.map(entry => `<button type="button" data-edit="${entry.key}" aria-label="Изменить ответ: ${escape(entry.label)}">${escape(entry.label)}${undo}</button>`).join('')}</div>` : '';
  };

  const questionMarkup = question => `<div class="picker-question-heading"><div><h2 id="picker-current-title" tabindex="-1">${escape(question.title)}</h2><p>${escape(question.hint)}</p></div><div class="picker-progress" aria-label="Вопрос ${question.number} из максимум трёх"><span class="picker-progress-caption">Ваш выбор</span><span>${question.number}<small> / 3</small></span><span class="picker-progress-track" aria-hidden="true">${[1, 2, 3].map(number => `<span class="${number <= question.number ? 'is-complete' : ''}"></span>`).join('')}</span></div></div>
    ${trail()}<div class="picker-options ${question.key === 'moment' ? 'is-moments' : ''}" role="group" aria-labelledby="picker-current-title">${question.options.map((option, index) => `<button type="button" class="picker-option ${option.id === 'any' ? 'is-any' : ''}" data-choice="${escape(option.id)}"><span class="picker-option-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${optionSymbol(question, option)}<span class="picker-option-copy"><span class="picker-option-label">${escape(question.key === 'moment' ? momentLabels[option.id] || option.label : option.label)}</span><span class="picker-option-hint">${escape(question.key === 'moment' ? momentHints[option.id] || option.hint : option.hint)}</span></span><span class="picker-option-arrow" aria-hidden="true">${arrow}</span></button>`).join('')}</div>
    <div class="picker-step-actions">${question.number > 1 ? `<button type="button" class="picker-text-button" data-action="back">${arrow} Назад</button>` : '<a href="menu.html">Открыть всё меню</a>'}<span>${question.number > 1 ? 'Если всё нравится,<br>выбирайте «Любой вариант».' : 'До трёх вопросов.<br>Можно передумать.'}</span></div>`;

  const card = item => `<article class="picker-result ${item.photo ? '' : 'has-type'}" data-result-id="${escape(item.id)}">
    ${visual(item)}<div class="picker-result-copy"><h3 ${item.photo ? '' : 'class="sr-only"'}>${escape(item.title)}</h3><p class="picker-result-summary">${escape(item.summary)}</p>${meta(item)}${composition(item)}
    <div class="picker-result-actions"><a href="${menuLink(item)}" aria-label="Посмотреть в меню: ${escape(item.title)}">В меню ${arrow}</a><button type="button" class="picker-result-compare" data-compare="${escape(item.id)}" aria-pressed="${selected.has(item.id)}" aria-label="${selected.has(item.id) ? 'Убрать из сравнения' : 'Сравнить'}: ${escape(item.title)} — ${escape(item.summary)}">${selected.has(item.id) ? 'В сравнении' : 'Сравнить'}</button></div>
    </div></article>`;

  const resultMarkup = () => {
    const { pool, visible } = core.results(data, answers, offset);
    const current = core.moment(data, answers.moment);
    const plated = [...visible].sort((a, b) => Number(!!b.photo) - Number(!!a.photo));
    return `<div class="picker-results-heading"><div><h2 id="picker-current-title" tabindex="-1">${pool.length === 1 ? 'Кажется, это ваше.' : 'Аппетит подсказал.'}</h2><p>${escape(current.resultLabel)}. ${pool.length > 1 ? 'Вот ваши идеи. Две можно сравнить рядом.' : 'Остаётся посмотреть состав и выбрать.'}</p></div><span class="picker-result-count">${countLabel(pool.length)} по вашим ответам</span></div>${trail()}
      <div class="picker-results ${visible.length === 1 ? 'has-one' : visible.length === 2 ? 'has-two' : ''}">${plated.map(card).join('')}</div>
      <div class="picker-result-footer">${pool.length > 3 ? `<button type="button" class="picker-more" data-action="more">Подать другие идеи ${arrow}</button>` : '<a class="picker-text-button" href="menu.html">Всё меню ' + arrow + '</a>'}<div><button type="button" class="picker-text-button" data-action="back">Изменить ответы</button><button type="button" class="picker-text-button" data-action="restart">Начать заново</button></div></div>
      <p class="picker-availability">Наличие блюд и варианты напитков уточняйте в кофейне.</p>
      <p class="picker-allergen-note">Подбор не учитывает аллергены и индивидуальные ограничения. Перед заказом уточните состав у бариста.</p>`;
  };

  const syncComparison = () => {
    bar.hidden = selected.size === 0;
    document.body.classList.toggle('has-comparison', selected.size > 0);
    document.getElementById('picker-comparison-count').textContent = `Выбрано ${selected.size} из 2`;
    bar.querySelector('[data-action="open-comparison"]').disabled = selected.size !== 2;
    stage.querySelectorAll('[data-compare]').forEach(button => {
      const chosen = selected.has(button.dataset.compare);
      const item = data.items.find(entry => entry.id === button.dataset.compare);
      button.setAttribute('aria-pressed', String(chosen));
      button.setAttribute('aria-label', `${chosen ? 'Убрать из сравнения' : 'Сравнить'}: ${item.title} — ${item.summary}`);
      button.textContent = chosen ? 'В сравнении' : 'Сравнить';
    });
  };

  const cancelReveal = () => {
    revealRevision++;
    revealAnimations.forEach(animation => animation.cancel());
    revealAnimations = [];
    stage.querySelectorAll('.picker-slot').forEach(slot => slot.remove());
    stage.querySelectorAll('.is-spinning').forEach(card => { card.classList.remove('is-spinning'); card.inert = false; });
    stage.removeAttribute('aria-busy');
  };

  const revealResults = () => {
    if (reducedMotion.matches || navigator.connection?.saveData || !Element.prototype.animate) return;
    const revision = revealRevision;
    const {pool} = core.results(data, answers, offset);
    const cards = [...stage.querySelectorAll('[data-result-id]')];
    const finishers = [];
    stage.setAttribute('aria-busy', 'true');
    message.textContent = 'Прокручиваем ваши варианты…';
    cards.forEach((card, column) => {
      const item = data.items.find(entry => entry.id === card.dataset.resultId);
      const field = card.querySelector('.picker-result-visual');
      const frameSizes = `${Math.ceil(field.getBoundingClientRect().width)}px`;
      const slot = document.createElement('div');
      slot.className = 'picker-slot';
      slot.setAttribute('aria-hidden', 'true');
      // The reel decorates the already computed recommendation; it does not alter matching.
      const frames = Array.from({length: 13 + column * 2}, (_, index) => pool[(index + column) % pool.length]);
      frames.push(item);
      slot.innerHTML = `<div class="picker-slot-track">${frames.map(entry => `<div class="picker-slot-face ${entry.photo ? '' : 'is-type'}">${entry.photo ? `<img src="${escape(entry.photo.src)}" srcset="${escape(entry.photo.srcset)}" sizes="${frameSizes}" width="${entry.photo.width}" height="${entry.photo.height}" alt="" decoding="async">` : `<span>${escape(entry.title)}</span><img src="assets/brand/mark-cream.svg" width="48" height="48" alt="">`}<span class="picker-slot-caption">${escape(entry.title)}</span></div>`).join('')}</div>`;
      field.append(slot);
      card.classList.add('is-spinning');
      card.inert = true;
      const track = slot.firstElementChild;
      const height = slot.getBoundingClientRect().height;
      const images = [...slot.querySelectorAll('img')];
      const ready = Promise.allSettled(images.map(img => img.decode()));
      // Start after decoding or a short bounded grace period so slow connections stay usable.
      const finished = Promise.race([ready, new Promise(resolve => setTimeout(resolve, 220))]).then(async () => {
        if (revision !== revealRevision || !slot.isConnected) return;
        const animation = track.animate([
          {transform: 'translateY(0)', filter: 'blur(0px)'},
          {transform: `translateY(-${height * (frames.length - 3)}px)`, filter: 'blur(2px)', offset: .66},
          {transform: `translateY(-${height * (frames.length - 1)}px)`, filter: 'blur(0px)'}
        ], {duration: 1300 + column * 180, easing: 'cubic-bezier(.12,.7,.16,1)', fill: 'forwards'});
        revealAnimations.push(animation);
        try { await animation.finished; } catch { return; }
        if (revision !== revealRevision) return;
        slot.remove();
        card.classList.remove('is-spinning');
        card.inert = false;
      });
      finishers.push(finished);
    });
    Promise.all(finishers).then(() => {
      if (revision !== revealRevision) return;
      revealAnimations.forEach(animation => animation.cancel());
      revealAnimations = [];
      stage.removeAttribute('aria-busy');
      message.textContent = 'Ваши варианты готовы.';
    });
  };

  const render = (moveFocus = false, reveal = false) => {
    cancelReveal();
    const question = core.question(data, answers);
    main.classList.toggle('is-results', !question);
    main.classList.toggle('is-in-progress', !!question && question.number > 1);
    window.KoritsaPhotoGallery.unmount(stage);
    stage.innerHTML = question ? questionMarkup(question) : resultMarkup();
    window.KoritsaPhotoGallery.mount(stage);
    stage.dataset.step = question?.key || 'result';
    message.textContent = '';
    syncComparison();
    if (!question && reveal) revealResults();
    if (moveFocus) {
      const heading = document.getElementById('picker-current-title');
      heading.focus({ preventScroll: true });
      const box = heading.getBoundingClientRect();
      const headerBottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
      if (box.top < headerBottom + 12 || box.bottom > innerHeight) stage.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };

  const setAnswers = next => {
    answers = core.normalize(data, next);
    const url = new URL(location.href);
    keys.forEach(key => {
      url.searchParams.delete(key);
      if (answers[key]) url.searchParams.set(key, answers[key]);
    });
    url.hash = '';
    history.pushState(null, '', url);
    offset = 0;
    selected.clear();
    if (dialog.open) dialog.close();
    render(true, !core.question(data, answers));
  };

  const edit = key => {
    const next = { ...answers };
    keys.slice(keys.indexOf(key)).forEach(field => delete next[field]);
    setAnswers(next);
  };

  const openComparison = () => {
    if (selected.size !== 2) return;
    window.KoritsaPhotoGallery.unmount(comparison);
    comparison.innerHTML = [...selected].map(id => {
      const item = data.items.find(entry => entry.id === id);
      return `<article class="picker-comparison-item" data-comparison-id="${escape(id)}">${visual(item, true)}<h3>${escape(item.title)}</h3>${meta(item)}<p>${escape(item.summary)}</p><h4>Состав по меню</h4><p>${escape(item.description || 'Состав уточняйте у бариста.')}</p><a class="text-link" href="${menuLink(item)}">Посмотреть в меню ${arrow}</a></article>`;
    }).join('');
    window.KoritsaPhotoGallery.mount(comparison);
    dialog.showModal();
  };

  main.addEventListener('click', event => {
    const choice = event.target.closest('[data-choice]');
    if (choice) {
      const question = core.question(data, answers);
      if (!question || !question.options.some(option => option.id === choice.dataset.choice)) return;
      const next = { ...answers, [question.key]: choice.dataset.choice };
      keys.slice(keys.indexOf(question.key) + 1).forEach(key => delete next[key]);
      setAnswers(next);
      return;
    }
    const editButton = event.target.closest('[data-edit]');
    if (editButton) { edit(editButton.dataset.edit); return; }
    const compareButton = event.target.closest('[data-compare]');
    if (compareButton) {
      const id = compareButton.dataset.compare;
      if (selected.has(id)) selected.delete(id);
      else if (selected.size < 2) selected.add(id);
      else { message.textContent = 'Сравниваем два блюда. Уберите одно из выбранных, чтобы добавить другое.'; return; }
      message.textContent = selected.size === 2 ? 'Два варианта выбраны. Нажмите «Сравнить два».' : selected.size === 1 ? 'Выберите ещё одно блюдо для сравнения.' : '';
      syncComparison();
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'back') {
      const key = answers.flavour ? 'flavour' : answers.direction ? 'direction' : 'moment';
      edit(key);
    } else if (action === 'restart') setAnswers({});
    else if (action === 'more') {
      offset += 3;
      render(true, true);
      message.textContent = 'Показали следующие подходящие варианты.';
    } else if (action === 'clear-comparison') {
      selected.clear();
      syncComparison();
      message.textContent = 'Сравнение очищено.';
      stage.querySelector('[data-compare]')?.focus();
    } else if (action === 'open-comparison') openComparison();
  });

  dialog.querySelector('.picker-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  window.addEventListener('popstate', () => {
    answers = readAddress();
    offset = 0;
    selected.clear();
    if (dialog.open) dialog.close();
    render(true);
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { cancelReveal(); message.textContent = ''; }
  });
  navigator.connection?.addEventListener('change', () => {
    if (navigator.connection.saveData) { cancelReveal(); message.textContent = ''; }
  });
  window.addEventListener('resize', () => {
    if (stage.hasAttribute('aria-busy')) { cancelReveal(); message.textContent = ''; }
  });
  render(false, !core.question(data, answers));
})();
