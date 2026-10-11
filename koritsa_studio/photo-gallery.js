(() => {
  'use strict';
  const source = document.getElementById('photo-gallery-data');
  if (!source) return;
  const dishes = JSON.parse(source.textContent);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const chevron = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const expand = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg>';
  const states = new WeakMap();
  const galleries = new Set();
  const autoplayDelay = 5000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';
  const playIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg>';
  const stopTimer = state => { clearTimeout(state.timer); state.timer = null; };
  const canPlay = (gallery, state) => gallery.isConnected && state.visible && !state.paused && !state.hovered && !state.focused && !state.pointer && !document.hidden && !document.querySelector('dialog[open]');
  const updatePlayback = (gallery, state) => {
    const button = gallery.querySelector('[data-gallery-autoplay]');
    if (!button) return;
    button.setAttribute('aria-label', state.paused ? 'Включить автоматическую смену фото' : 'Остановить автоматическую смену фото');
    button.innerHTML = state.paused ? playIcon : pauseIcon;
    // Automatic changes must not repeatedly interrupt screen reader speech.
    gallery.querySelector('.photo-gallery-counter')?.setAttribute('aria-live', state.paused ? 'polite' : 'off');
  };
  const schedule = gallery => {
    const state = states.get(gallery);
    if (!state) return;
    stopTimer(state);
    if (!canPlay(gallery, state) || dishes[gallery.dataset.photoGallery].photos.length < 2) return;
    state.timer = setTimeout(async () => {
      state.timer = null;
      if (!canPlay(gallery, state)) return;
      if (gallery.closest('[inert], .is-spinning')) { schedule(gallery); return; }
      const last = dishes[gallery.dataset.photoGallery].photos.length - 1;
      if (state.index === last) state.direction = -1;
      if (state.index === 0) state.direction = 1;
      await show(gallery, state.index + state.direction, true);
      schedule(gallery);
    }, autoplayDelay);
  };
  const pause = gallery => {
    const state = states.get(gallery);
    if (!state) return;
    state.paused = true;
    stopTimer(state);
    updatePlayback(gallery, state);
  };
  const markup = (id, className = '', sizes = '(max-width: 767px) 90vw, 600px', expanded = false) => {
    const item = dishes[id];
    if (!item) return '';
    return `<div class="photo-gallery ${escape(className)} ${item.photos.length === 1 ? 'is-single' : ''}" data-photo-gallery="${escape(id)}" data-sizes="${escape(sizes)}" role="region" aria-roledescription="галерея" aria-label="Фотографии: ${escape(item.title)}" tabindex="0"><div class="photo-gallery-track">${item.photos.map((p, i) => `<figure class="photo-gallery-slide" aria-hidden="${i !== 0}"><img ${i === 0 ? `src="${escape(p.src)}" srcset="${escape(p.srcset)}"` : ''} data-photo-index="${i}" sizes="${escape(sizes)}" width="${p.width}" height="${p.height}" alt="${escape(item.title)} — фото ${i + 1} из ${item.photos.length}" decoding="async" ${i === 0 ? 'loading="eager"' : 'loading="lazy"'}></figure>`).join('')}</div>${!expanded ? `<button class="photo-gallery-expand" type="button" data-gallery-open="${escape(id)}" aria-label="Увеличить фотографии: ${escape(item.title)}">${expand}</button>` : ''}${item.photos.length > 1 ? `<div class="photo-gallery-controls"><button type="button" data-gallery-step="-1" aria-label="Предыдущее фото" disabled>${chevron}</button><span class="photo-gallery-counter" role="status" aria-live="polite" aria-atomic="true">1 / ${item.photos.length}</span><button type="button" data-gallery-step="1" aria-label="Следующее фото">${chevron}</button><span class="photo-gallery-line" aria-hidden="true"><span style="width:${100 / item.photos.length}%"></span></span></div>` : ''}</div>`;
  };
  const hydrate = (gallery, index) => {
    const photos = dishes[gallery.dataset.photoGallery].photos;
    [index - 1, index, index + 1].forEach(i => {
      const img = gallery.querySelector(`[data-photo-index="${i}"]`);
      if (!img || img.hasAttribute('src')) return;
      img.src = photos[i].src;
      img.srcset = photos[i].srcset;
      img.loading = 'eager';
    });
  };
  const show = async (gallery, requested, automatic = false) => {
    const state = states.get(gallery);
    if (!state) return;
    if (!automatic) pause(gallery);
    const item = dishes[gallery.dataset.photoGallery];
    const index = Math.max(0, Math.min(requested, item.photos.length - 1));
    state.index = index;
    const revision = ++state.revision;
    hydrate(gallery, index);
    const image = gallery.querySelector(`[data-photo-index="${index}"]`);
    try { await image.decode(); } catch { /* Keep navigation usable on slow or failed loads. */ }
    if (!gallery.isConnected || revision !== state.revision) return;
    if (automatic && !canPlay(gallery, state)) { state.index = state.displayedIndex; return; }
    const track = gallery.querySelector('.photo-gallery-track');
    const jump = Math.abs(index - state.displayedIndex) > 1;
    // Direct jumps (Home/End or an enlarged view) must not sweep through unloaded frames.
    if (jump) track.style.transition = 'none';
    track.style.transform = `translateX(-${index * 100}%)`;
    if (jump) { track.getBoundingClientRect(); track.style.transition = ''; }
    state.displayedIndex = index;
    gallery.querySelectorAll('.photo-gallery-slide').forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
    const counter = gallery.querySelector('.photo-gallery-counter');
    if (counter) counter.textContent = `${index + 1} / ${item.photos.length}`;
    const previous = gallery.querySelector('[data-gallery-step="-1"]');
    const next = gallery.querySelector('[data-gallery-step="1"]');
    if (previous) previous.disabled = index === 0;
    if (next) next.disabled = index === item.photos.length - 1;
    const line = gallery.querySelector('.photo-gallery-line>span');
    if (line) line.style.width = `${(index + 1) / item.photos.length * 100}%`;
  };
  const mount = (root = document) => {
    root.querySelectorAll('[data-photo-gallery]').forEach(gallery => {
      if (states.has(gallery)) return;
      const state = {index: 0, displayedIndex: 0, revision: 0, pointer: null, timer: null, visible: false, hovered: false, focused: false, paused: reducedMotion.matches || !!gallery.closest('dialog'), direction: 1};
      states.set(gallery, state);
      galleries.add(gallery);
      const controls = gallery.querySelector('.photo-gallery-controls');
      if (controls && !gallery.closest('dialog')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'photo-gallery-autoplay';
        button.dataset.galleryAutoplay = '';
        controls.append(button);
        updatePlayback(gallery, state);
      }
      gallery.addEventListener('click', event => {
        if (event.target.closest('[data-gallery-autoplay]')) {
          state.paused = !state.paused;
          if (!state.paused) state.focused = false;
          updatePlayback(gallery, state);
          schedule(gallery);
          return;
        }
        const button = event.target.closest('[data-gallery-step]');
        if (button) { event.stopPropagation(); show(gallery, state.index + Number(button.dataset.galleryStep)); }
      });
      gallery.addEventListener('keydown', event => {
        const targetIsGallery = event.target === gallery;
        if (!targetIsGallery) return;
        const next = event.key === 'ArrowRight' ? state.index + 1 : event.key === 'ArrowLeft' ? state.index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? dishes[gallery.dataset.photoGallery].photos.length - 1 : null;
        if (next !== null) { event.preventDefault(); show(gallery, next); }
      });
      gallery.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
        pause(gallery);
        state.pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
        gallery.setPointerCapture(event.pointerId);
      });
      gallery.addEventListener('pointerup', event => {
        const start = state.pointer;
        state.pointer = null;
        if (!start || start.id !== event.pointerId) return;
        const x = event.clientX - start.x, y = event.clientY - start.y;
        if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.3) show(gallery, state.index + (x < 0 ? 1 : -1));
      });
      gallery.addEventListener('pointercancel', () => { state.pointer = null; });
      gallery.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { state.hovered = true; stopTimer(state); } });
      gallery.addEventListener('pointerleave', () => { state.hovered = false; schedule(gallery); });
      gallery.addEventListener('focusin', () => { state.focused = true; stopTimer(state); });
      gallery.addEventListener('focusout', event => { if (!gallery.contains(event.relatedTarget)) { state.focused = false; schedule(gallery); } });
      gallery.querySelectorAll('img').forEach(img => img.draggable = false);
      // Only visible galleries fetch adjacent images. Future result cards stay unloaded.
      observer.observe(gallery);
    });
  };
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const state = states.get(entry.target);
    if (!state) return;
    state.visible = entry.isIntersecting && entry.intersectionRatio >= .4;
    if (entry.isIntersecting) hydrate(entry.target, state.index);
    schedule(entry.target);
  }), {threshold: [0, .4]});
  const unmount = root => root.querySelectorAll('[data-photo-gallery]').forEach(gallery => {
    const state = states.get(gallery);
    if (state) { stopTimer(state); state.revision++; }
    observer.unobserve(gallery);
    galleries.delete(gallery);
    states.delete(gallery);
  });
  document.addEventListener('visibilitychange', () => galleries.forEach(schedule));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) galleries.forEach(pause);
  });
  const dialog = document.createElement('dialog');
  dialog.className = 'photo-gallery-dialog';
  dialog.setAttribute('aria-labelledby', 'photo-gallery-title');
  document.body.append(dialog);
  let opener = null;
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-open]');
    if (!button) return;
    const id = button.dataset.galleryOpen, item = dishes[id];
    if (!item) return;
    opener = button;
    galleries.forEach(gallery => stopTimer(states.get(gallery)));
    unmount(dialog);
    dialog.innerHTML = `<div class="photo-gallery-dialog-heading"><h2 id="photo-gallery-title">${escape(item.title)}</h2><button type="button" data-gallery-close aria-label="Закрыть фотографии">×</button></div>${markup(id, 'is-expanded', '(max-width: 767px) 94vw, 960px', true)}`;
    mount(dialog);
    dialog.showModal();
    const parent = button.closest('[data-photo-gallery]');
    if (parent) show(dialog.querySelector('[data-photo-gallery]'), states.get(parent)?.index || 0);
  });
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-gallery-close]')) dialog.close();
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    unmount(dialog);
    dialog.innerHTML = '';
    opener?.focus({preventScroll: true});
    galleries.forEach(schedule);
  });
  window.KoritsaPhotoGallery = {markup, mount, unmount};
  mount();
})();
