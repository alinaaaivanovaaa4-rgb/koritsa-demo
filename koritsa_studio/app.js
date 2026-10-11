(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  const closeNav = () => {
    header.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeNav();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) {
      closeNav();
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeNav();
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', closeNav);

  const layout = document.querySelector('.stories-layout');
  if (layout) {
    const wide = window.matchMedia('(min-width: 1000px)');
    const chapters = [...layout.querySelectorAll('[data-chapter]')];
    const slides = [...layout.querySelectorAll('[data-slide]')];
    const links = [...layout.querySelectorAll('[data-story-link]')];
    let observer;
    const choices = chapters.map((chapter, index) => ({
      chapter,
      dishes: [...chapter.querySelectorAll('[data-dish]')],
      photos: [...chapter.querySelectorAll('[data-dish-photo]'), ...slides[index].querySelectorAll('[data-dish-photo]')],
      selected: 0,
      request: 0
    }));
    const loadPhotos = (choice, index) => {
      const images = choice.photos.filter(photo => Number(photo.dataset.dishPhoto) === index).map(photo => photo.querySelector('img'));
      return Promise.allSettled(images.map(image => {
        image.loading = 'eager';
        if (image.decode) return image.decode();
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      }));
    };
    const changeDish = (index, direction) => {
      const choice = choices[index];
      if (choice.dishes.length < 2) return;
      choice.selected = (choice.selected + direction + choice.dishes.length) % choice.dishes.length;
      const selected = choice.selected;
      const request = ++choice.request;
      choice.chapter.setAttribute('aria-busy', 'true');
      const ready = loadPhotos(choice, selected);
      let timeout;
      Promise.race([ready, new Promise(resolve => { timeout = setTimeout(resolve, 4000); })]).then(() => {
        clearTimeout(timeout);
        if (request !== choice.request) return;
        choice.dishes.forEach((dish, i) => {
          const active = i === selected;
          dish.classList.toggle('is-active', active);
          dish.inert = !active;
          if (active) dish.removeAttribute('aria-hidden');
          else dish.setAttribute('aria-hidden', 'true');
        });
        choice.photos.forEach(photo => { photo.hidden = Number(photo.dataset.dishPhoto) !== selected; });
        choice.chapter.querySelector('[data-dish-number]').textContent = selected + 1;
        choice.chapter.querySelector('[data-dish-status]').textContent = `${choice.dishes[selected].dataset.dishTitle}. ${selected + 1} из ${choice.dishes.length}.`;
        choice.chapter.removeAttribute('aria-busy');
        loadPhotos(choice, (selected + 1) % choice.dishes.length);
      });
    };
    choices.forEach((choice, index) => {
      choice.chapter.querySelectorAll('[data-dish-step]').forEach(button => {
        button.addEventListener('click', () => changeDish(index, Number(button.dataset.dishStep)));
      });
      choice.chapter.querySelector('.dish-browse')?.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        changeDish(index, event.key === 'ArrowLeft' ? -1 : 1);
      });
    });
    layout.querySelectorAll('[data-dish-swipe]').forEach(surface => {
      let start;
      surface.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      });
      surface.addEventListener('pointerup', event => {
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        start = undefined;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) changeDish(Number(surface.dataset.dishSwipe), dx < 0 ? 1 : -1);
      });
      surface.addEventListener('pointercancel', () => { start = undefined; });
      surface.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') start = undefined; });
    });
    layout.classList.add('has-dish-carousel');
    const activate = index => {
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
      links.forEach((link, i) => {
        link.classList.toggle('is-active', i === index);
        if (i === index) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      const choice = choices[index];
      loadPhotos(choice, choice.selected).then(() => loadPhotos(choice, (choice.selected + 1) % choice.dishes.length));
    };
    const adaptStories = () => {
      if (observer) observer.disconnect();
      const enhanced = wide.matches && 'IntersectionObserver' in window;
      layout.classList.toggle('is-enhanced', enhanced);
      if (enhanced) {
        observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) activate(Number(entry.target.dataset.chapter));
          });
        }, { rootMargin: '-32% 0px -42% 0px', threshold: 0 });
        chapters.forEach(chapter => observer.observe(chapter));
      }
    };
    links.forEach(link => link.addEventListener('click', () => activate(Number(link.dataset.storyLink))));
    wide.addEventListener('change', adaptStories);
    adaptStories();
    activate(0);
  }

  const hero = document.querySelector('.hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      document.body.classList.toggle('dock-visible', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  const search = document.querySelector('#menu-query');
  if (!search) return;
  document.body.classList.add('has-search');
  const rows = [...document.querySelectorAll('.menu-item')];
  const sections = [...document.querySelectorAll('[data-category-section]')];
  const filters = [...document.querySelectorAll('[data-category-filter]')];
  const status = document.querySelector('.results-status');
  const empty = document.querySelector('.empty-state');
  const clear = document.querySelector('.search-clear');
  const note = document.querySelector('.drinks-note');
  const categoryRail = document.querySelector('.category-nav');
  const params = new URLSearchParams(location.search);
  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  let category = filters.some(filter => filter.dataset.categoryFilter === params.get('category')) ? params.get('category') : 'all';
  const revealActiveCategory = () => {
    if (categoryRail.scrollWidth <= categoryRail.clientWidth) return;
    const active = filters.find(filter => filter.dataset.categoryFilter === category);
    const railBox = categoryRail.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(categoryRail).paddingLeft);
    if (box.left < railBox.left + padding || box.right > railBox.right - padding) {
      categoryRail.scrollTo({left: active.offsetLeft - padding, behavior: 'instant'});
    }
  };
  const countLabel = count => {
    const last = count % 10, lastTwo = count % 100;
    const ending = last === 1 && lastTwo !== 11 ? 'позиция' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'позиции' : 'позиций';
    return `${count} ${ending}`;
  };
  const update = () => {
    const query = normalize(search.value);
    const terms = query.split(/\s+/).filter(Boolean);
    let count = 0;
    rows.forEach(row => {
      const match = (category === 'all' || row.dataset.category === category) && terms.every(term => normalize(row.dataset.search).includes(term));
      row.hidden = !match;
      if (match) count++;
    });
    sections.forEach(section => {
      section.hidden = !section.querySelector('.menu-item:not([hidden])');
      section.querySelectorAll('.menu-group').forEach(group => {
        let current = group.nextElementSibling, visible = false;
        while (current && !current.classList.contains('menu-group')) {
          if (current.classList.contains('menu-item') && !current.hidden) visible = true;
          current = current.nextElementSibling;
        }
        group.hidden = !visible;
      });
    });
    filters.forEach(filter => {
      const active = filter.dataset.categoryFilter === category;
      filter.classList.toggle('is-active', active);
      if (active) filter.setAttribute('aria-current', 'true');
      else filter.removeAttribute('aria-current');
    });
    status.textContent = query ? `${countLabel(count)} по запросу «${search.value.trim()}»` : `${countLabel(count)} в меню`;
    empty.hidden = count > 0;
    clear.hidden = !search.value;
    note.hidden = !sections.some(section => section.dataset.categorySection === 'drinks' && !section.hidden);
    revealActiveCategory();
  };
  const setCategory = (value, updateAddress = true) => {
    category = value;
    if (updateAddress) {
      const url = new URL(location.href);
      url.hash = '';
      if (value === 'all') url.searchParams.delete('category');
      else url.searchParams.set('category', value);
      history.replaceState(null, '', url);
    }
    update();
  };
  filters.forEach(filter => filter.addEventListener('click', event => {
    event.preventDefault();
    search.value = '';
    setCategory(filter.dataset.categoryFilter);
    document.querySelector('.menu-results').scrollIntoView({ block: 'start', behavior: 'instant' });
  }));
  search.addEventListener('input', () => {
    if (category !== 'all') setCategory('all');
    else update();
  });
  document.querySelector('.menu-search').addEventListener('submit', event => event.preventDefault());
  const reset = () => {
    search.value = '';
    setCategory('all');
    search.focus({ preventScroll: true });
  };
  clear.addEventListener('click', reset);
  document.querySelector('.reset-search').addEventListener('click', reset);
  update();
  document.fonts.ready.then(revealActiveCategory);
  if (location.hash.startsWith('#menu-')) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      const details = target.querySelector('details');
      if (details) details.open = true;
      document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        target.focus({ preventScroll: true });
      })));
    }
  }
})();
