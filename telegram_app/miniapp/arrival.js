(() => {
  const overlay = document.querySelector('#mini-arrival');
  if (!overlay) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const simple = reduced.matches || !!navigator.connection?.saveData;
  const preview = new URLSearchParams(location.search).get('intro') === '1';
  const started = performance.now();
  const minimum = simple ? 0 : preview ? 3600 : 1200;
  const siblings = [...document.body.children].filter(el => el !== overlay && el.tagName !== 'SCRIPT' && !el.inert);
  const skip = document.querySelector('#arrival-skip');
  let released = false, closing = false, catalogReady = false, delay, exitTimer;
  root.classList.add('arrival-active');
  overlay.classList.toggle('arrival-simple', simple);
  siblings.forEach(el => { el.inert = true; });
  function release() {
    if (released) return;
    released = true; clearTimeout(deadline); clearTimeout(delay); clearTimeout(exitTimer);
    const hadFocus = overlay.contains(document.activeElement);
    document.removeEventListener('keydown', keys);
    siblings.forEach(el => { el.inert = false; });
    root.classList.remove('arrival-active'); overlay.hidden = true;
    if (hadFocus) document.querySelector('#search-input')?.focus({preventScroll:true});
    window.dispatchEvent(new Event('koritsa-arrival-closed'));
  }
  function leave(immediate = false) {
    if (released || closing) return;
    closing = true;
    if (immediate || simple) release();
    else { overlay.classList.add('arrival-closing'); exitTimer = setTimeout(release, 300); }
  }
  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); leave(true); }
    if (event.key === 'Tab') { event.preventDefault(); skip.focus(); }
  }
  document.addEventListener('keydown', keys);
  skip.addEventListener('click', () => leave(true));
  overlay.addEventListener('animationend', event => { if (event.target === overlay && closing) release(); });
  document.addEventListener('visibilitychange', () => overlay.classList.toggle('arrival-paused', document.hidden));
  window.addEventListener('pagehide', release, {once:true});
  const deadline = setTimeout(() => leave(true), 6500);
  const font = document.fonts ? document.fonts.load('500 24px Onest').catch(() => {}) : Promise.resolve();
  window.__koritsaMiniArrival = {
    ready() {
      if (catalogReady || released || closing) return;
      catalogReady = true;
      document.querySelector('#arrival-status').textContent = 'Меню готово';
      font.then(() => { if (!released && !closing) delay = setTimeout(() => leave(), Math.max(0, minimum - (performance.now() - started))); });
    },
    error() { leave(true); }
  };
  const scene = overlay.querySelector('.arrival-scene');
  const beans = overlay.querySelector('.arrival-beans');
  if (!simple) for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * scene.clientWidth * .36;
    const y = Math.sin(angle) * scene.clientHeight * .36;
    const bean = document.createElement('span'); bean.className = 'arrival-bean';
    const values = {'--x':x+'px','--y':y+'px','--in-x':x*1.22+'px','--in-y':y*1.22+'px',
      '--turn':i*47-35+'deg','--size':Math.min(scene.clientWidth,scene.clientHeight)*(.105+(i%3)*.018)+'px','--delay':(i%6)*.024+'s'};
    Object.entries(values).forEach(([key,value]) => bean.style.setProperty(key,value)); beans.append(bean);
  }
})();
