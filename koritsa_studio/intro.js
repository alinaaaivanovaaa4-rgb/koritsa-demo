(() => {
  const intro = document.querySelector('.site-intro');
  const boot = window.__koritsaIntro;
  if (!intro || !boot || !document.documentElement.classList.contains('intro-pending')) {
    intro?.remove();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const simplified = reduced.matches || !!navigator.connection?.saveData;
  intro.classList.toggle('intro-simple', simplified);
  const skip = intro.querySelector('.intro-skip');
  const status = intro.querySelector('.intro-status');
  const previousFocus = document.activeElement;
  const background = [...document.body.children].filter(el => el !== intro && el.tagName !== 'SCRIPT' && !el.inert);
  let leaving = false, released = false, delay, deadline;

  background.forEach(el => { el.inert = true; });
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(window.__koritsaIntroFailSafe);
    clearTimeout(delay);
    clearTimeout(deadline);
    document.removeEventListener('keydown', onKeyDown);
    const hadFocus = intro.contains(document.activeElement);
    background.forEach(el => { el.inert = false; });
    document.documentElement.classList.remove('intro-pending');
    intro.remove();
    try { sessionStorage.setItem('koritsa-arrival-v1', 'seen'); } catch {}
    if (hadFocus) {
      const target = previousFocus !== document.body && previousFocus?.isConnected
        ? previousFocus : document.querySelector('.hero .primary-link');
      target?.focus({ preventScroll: true });
    }
  };
  window.__koritsaIntroRelease = release;

  const leave = immediate => {
    if (leaving || released) return;
    leaving = true;
    clearTimeout(delay);
    clearTimeout(deadline);
    status.textContent = 'Открываем «Корицу»';
    intro.classList.remove('intro-paused');
    if (immediate) release();
    else {
      intro.classList.add('intro-leaving');
      deadline = setTimeout(release, reduced.matches ? 0 : 420);
    }
  };

  const scene = intro.querySelector('.intro-scene');
  const beans = intro.querySelector('.intro-beans');
  const sceneSize = Math.min(scene.clientWidth, scene.clientHeight);
  const total = simplified ? 0 : window.innerWidth < 768 ? 12 : 16;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < total; i++) {
    const angle = i / total * Math.PI * 2 - Math.PI / 2;
    const radius = .34 + (i % 3) * .018;
    const x = Math.cos(angle) * scene.clientWidth * radius;
    const y = Math.sin(angle) * scene.clientHeight * radius;
    const bean = document.createElement('span');
    bean.className = 'intro-bean';
    const values = {
      '--bean-size': `${sceneSize * (.105 + (i % 3) * .018)}px`,
      '--bean-x': `${x}px`, '--bean-y': `${y}px`,
      '--bean-in-x': `${x * 1.22}px`, '--bean-in-y': `${y * 1.22}px`,
      '--bean-out-x': `${x * 1.38}px`, '--bean-out-y': `${y * 1.38}px`,
      '--bean-turn': `${i * 47 - 35}deg`, '--bean-delay': `${(i % 6) * .024}s`
    };
    Object.entries(values).forEach(([key, value]) => bean.style.setProperty(key, value));
    fragment.append(bean);
  }
  beans.append(fragment);

  skip.addEventListener('click', () => leave(true));
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); leave(true); }
    if (event.key === 'Tab') { event.preventDefault(); skip.focus(); }
  };
  document.addEventListener('keydown', onKeyDown);
  intro.addEventListener('animationend', event => {
    if (leaving && event.target === intro) release();
  });
  window.addEventListener('pagehide', release, { once: true });
  document.addEventListener('visibilitychange', () => {
    intro.classList.toggle('intro-paused', document.hidden);
  });
  reduced.addEventListener('change', () => {
    if (leaving && reduced.matches) release();
  });

  const readyImage = image => {
    if (!image) return Promise.resolve();
    const loaded = image.complete ? Promise.resolve() : new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
    return loaded.then(() => image.decode ? image.decode().catch(() => {}) : undefined);
  };
  let progress = 0;
  const markReady = amount => {
    if (released) return;
    progress += amount;
    intro.style.setProperty('--intro-progress', Math.min(1, progress));
  };
  const fonts = document.fonts ? document.fonts.load('500 24px Onest').catch(() => {}) : Promise.resolve();
  const firstPhoto = readyImage(document.querySelector('.hero-photo img'));
  const decoration = simplified ? Promise.resolve() : (() => {
    const beanImage = new Image();
    beanImage.src = 'assets/intro/coffee-bean.webp';
    return Promise.allSettled([
      readyImage(beanImage),
      ...[...intro.querySelectorAll('.intro-dish')].map(readyImage)
    ]);
  })();
  fonts.then(() => markReady(.35));
  firstPhoto.then(() => markReady(.55));
  decoration.then(() => markReady(.1));
  const minimum = simplified ? 0 : boot.preview ? 3600 : 1300;
  Promise.allSettled([fonts, firstPhoto, decoration]).then(() => {
    if (leaving || released) return;
    status.textContent = 'Всё для хорошего начала';
    delay = setTimeout(() => leave(simplified), Math.max(0, minimum - (performance.now() - boot.started)));
  });
  deadline = setTimeout(() => leave(simplified), Math.max(0, 5500 - (performance.now() - boot.started)));
})();
