(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const autoplayAllowed = () => !reduced.matches && !connection?.saveData;
  document.querySelectorAll('[data-film]').forEach(scene => {
    const frame = scene.querySelector('.film-frame');
    const video = scene.querySelector('video');
    const poster = frame.querySelector('img');
    const start = scene.querySelector('[data-film-start]');
    const control = scene.querySelector('[data-film-toggle]');
    const label = start.querySelector('[data-film-label]');
    const status = scene.querySelector('.film-status');
    const originalLabel = label.textContent;
    let loading = false;
    let request = 0;
    let userPaused = false;
    let visibilityPause = false;
    let autoBlocked = false;
    let failed = false;
    start.hidden = false;
    video.muted = true;

    const message = text => {
      status.textContent = text;
      status.hidden = !text;
    };
    const visibleFraction = () => {
      if (document.hidden) return 0;
      const box = frame.getBoundingClientRect();
      if (!box.height) return 0;
      return Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)) / box.height;
    };
    const updateControl = () => {
      const paused = video.paused;
      control.setAttribute('aria-label', paused ? 'Продолжить воспроизведение ролика' : 'Поставить ролик на паузу');
      control.querySelector('path').setAttribute('d', paused ? 'm9 5 11 7-11 7Z' : 'M8 5v14M16 5v14');
    };
    const pauseForVisibility = () => {
      if (!video.paused) {
        visibilityPause = true;
        video.pause();
      }
    };
    const recover = () => {
      request++;
      loading = false;
      failed = true;
      pauseForVisibility();
      video.hidden = true;
      poster.hidden = false;
      control.hidden = true;
      start.hidden = false;
      start.disabled = false;
      label.textContent = 'Попробовать ещё раз';
      message('Ролик не загрузился. Фотография остаётся доступна.');
    };
    const playFilm = async manual => {
      if (loading) return;
      if (!manual && (!autoplayAllowed() || userPaused || autoBlocked || failed || visibleFraction() < .35)) return;
      if (manual) {
        userPaused = false;
        failed = false;
        autoBlocked = false;
      }
      loading = true;
      const currentRequest = ++request;
      start.disabled = true;
      label.textContent = 'Загружаем ролик';
      if (manual) message('Загружаем ролик.');
      // Attach the source only when visible or when the visitor starts the film.
      // Retain it on pause so returning to the scene reuses the loaded video.
      if (!video.getAttribute('src') || video.error) {
        video.src = video.dataset.videoSrc;
        video.load();
      }
      try {
        await video.play();
        if (currentRequest !== request) return;
        video.hidden = false;
        poster.hidden = true;
        start.hidden = true;
        control.hidden = false;
        updateControl();
        message('');
        if (manual) video.focus({ preventScroll: true });
        if (!visibleFraction()) pauseForVisibility();
      } catch (error) {
        if (currentRequest !== request) return;
        if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
          if (error.name === 'NotAllowedError') autoBlocked = true;
          message('');
        } else recover();
      } finally {
        if (currentRequest === request) {
          loading = false;
          start.disabled = false;
          label.textContent = originalLabel;
        }
      }
    };
    const maybeAutoplay = () => { if (video.paused) playFilm(false); };
    start.addEventListener('click', () => playFilm(true));
    control.addEventListener('click', () => {
      if (video.paused) playFilm(true);
      else {
        userPaused = true;
        video.pause();
      }
    });
    video.addEventListener('error', recover);
    video.addEventListener('play', () => {
      updateControl();
      if (!visibleFraction()) pauseForVisibility();
    });
    video.addEventListener('pause', () => {
      updateControl();
      if (visibilityPause) visibilityPause = false;
      else if (!video.ended && visibleFraction()) userPaused = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseForVisibility();
      else maybeAutoplay();
    });
    const preferenceChanged = () => {
      if (!autoplayAllowed()) pauseForVisibility();
      else maybeAutoplay();
    };
    reduced.addEventListener('change', preferenceChanged);
    connection?.addEventListener?.('change', preferenceChanged);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) pauseForVisibility();
        else if (entries[0].intersectionRatio >= .35) maybeAutoplay();
      }, { threshold: [0, .35] }).observe(frame);
    } else {
      const onScroll = () => {
        if (!visibleFraction()) pauseForVisibility();
        else maybeAutoplay();
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });
})();
