(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const body = document.body;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  body.classList.add('js-ready');

  // A blocked storage API (including some file:// contexts) must not break the page.
  const preference = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Session-only preference. */ } }
  };
  const themeButton = $('.theme-toggle');
  const applyTheme = (dark) => {
    body.classList.toggle('dark', dark);
    themeButton?.setAttribute('aria-pressed', String(dark));
    themeButton?.setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme');
    const label = $('.theme-label');
    if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    document.dispatchEvent(new Event('portfolio:theme'));
  };
  applyTheme(preference.get('sk-theme') === 'dark');
  themeButton?.addEventListener('click', () => {
    const dark = !body.classList.contains('dark');
    applyTheme(dark);
    preference.set('sk-theme', dark ? 'dark' : 'light');
  });

  const menuButton = $('.menu-toggle');
  const nav = $('#primary-nav');
  const setMenu = (open) => {
    nav?.classList.toggle('open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
    const icon = $('span', menuButton);
    if (icon) icon.textContent = open ? '−' : '+';
  };
  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  $$('a', nav).forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.topbar')) setMenu(false);
  });

  const progress = $('.reading-progress');
  const opening = $('.hero-spatial');
  let reducedPageMotion = motionPreference.matches;
  let scrollPending = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    if (progress) progress.style.transform = 'scaleX(' + ratio + ')';
    body.classList.toggle('has-scrolled', window.scrollY > 48);
    if (opening) {
      const bounds = opening.getBoundingClientRect();
      const exit = reducedPageMotion ? 0 : Math.max(0, Math.min(1, -bounds.top / Math.max(bounds.height, 1)));
      opening.style.setProperty('--scene-exit', exit.toFixed(3));
    }
    scrollPending = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollPending) {
      scrollPending = true;
      requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  document.addEventListener('toggle', updateProgress, true);
  motionPreference.addEventListener('change', event => { reducedPageMotion = event.matches; updateProgress(); });
  updateProgress();

  // Highlight reading position without moving focus or controlling the scroll.
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    const chapters = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target.id, entry.isIntersecting));
      const current = [...visible].find(([, isVisible]) => isVisible)?.[0];
      $$('.primary-nav a').forEach(link => {
        if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-12% 0px -60% 0px', threshold: 0 });
    $$('.chapter').forEach(chapter => chapters.observe(chapter));

    // Each chapter has one measured entrance. Native scroll remains in charge;
    // the text stays visible if observers or animation support are unavailable.
    const moments = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('moment-present', entry.isIntersecting && !motionPreference.matches);
      });
    }, { threshold: .16 });
    $$('.statement-grid, .feature-layout, .research-grid, .about-intro').forEach(item => {
      item.classList.add('story-moment');
      moments.observe(item);
    });

    // One quiet entrance per detail; nothing is hidden before the observer runs.
    const arrivals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (!motionPreference.matches) entry.target.classList.add('story-arrived');
        arrivals.unobserve(entry.target);
      });
    }, { threshold: .12 });
    $$('.story-intro h4, .system-flow>div, .brain-stages li, .research-fields>div').forEach((item, index) => {
      item.style.setProperty('--reveal-delay', (index % 3) * 45 + 'ms');
      arrivals.observe(item);
    });
    const path = $('.m-path');
    if (path) new IntersectionObserver(entries => {
      path.classList.toggle('in-view', entries[0].isIntersecting);
    }).observe(path);
  }
  document.addEventListener('visibilitychange', () => body.classList.toggle('page-hidden', document.hidden));

  const pipelineText = {
    sources: 'Architectural passages enter with their source and licence recorded. The knowledge graph keeps claims connected to evidence.',
    decisions: 'Candidate values are checked against their quoted passages and jurisdiction. Surviving evidence supplies the dimensions and records rejected alternatives.',
    geometry: 'Validated operations reach a Rust geometry kernel through a native process boundary. The geometry supplies measurable plan and section information.'
  };
  $$('.pipeline-node').forEach(button => button.addEventListener('click', () => {
    $$('.pipeline-node').forEach(node => {
      const selected = node === button;
      node.classList.toggle('active', selected);
      node.setAttribute('aria-pressed', String(selected));
    });
    $('#pipeline-note').textContent = pipelineText[button.dataset.stage];
  }));

  // Portfolio companion: seeded, matching-edge tiles. This is explicitly an
  // adjacency illustration, not a reimplementation of the original WFC product.
  const tileGrid = $('#wfc-grid');
  const tileSeed = $('#wfc-seed');
  let seed = 24;
  function drawTiles() {
    if (!tileGrid) return;
    const columns = 8, rows = 6;
    const masks = new Array(columns * rows).fill(0);
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    // Each loop toggles both sides of four shared edges, so all edges match
    // and the outer boundary stays closed for every possible seed.
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < columns - 1; col++) {
        if (random() < .57) {
          const a = row * columns + col;
          masks[a] ^= 6;
          masks[a + 1] ^= 12;
          masks[a + columns + 1] ^= 9;
          masks[a + columns] ^= 3;
        }
      }
    }
    const fragment = document.createDocumentFragment();
    masks.forEach(mask => {
      const tile = document.createElement('div');
      tile.className = 'wfc-tile';
      tile.dataset.edges = String(mask);
      tile.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 60 60');
      const coordinates = { 1: '30 0', 2: '60 30', 4: '30 60', 8: '0 30' };
      const sides = [1, 2, 4, 8].filter(bit => mask & bit);
      const path = document.createElementNS(svg.namespaceURI, 'path');
      const d = sides.length === 2
        ? 'M ' + coordinates[sides[0]] + ' Q 30 30 ' + coordinates[sides[1]]
        : sides.map(bit => 'M 30 30 L ' + coordinates[bit]).join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '2');
      svg.append(path);
      if (!sides.length) {
        const dot = document.createElementNS(svg.namespaceURI, 'circle');
        dot.setAttribute('cx', '30'); dot.setAttribute('cy', '30');
        dot.setAttribute('r', '1.3'); dot.setAttribute('fill', 'currentColor');
        svg.append(dot);
      }
      tile.append(svg);
      fragment.append(tile);
    });
    tileGrid.replaceChildren(fragment);
    tileGrid.setAttribute('aria-label', 'Procedural tile pattern, seed ' + seed + '. All neighboring connections match.');
    if (tileSeed) tileSeed.textContent = 'Seed ' + String(seed).padStart(3, '0');
  }
  $('#regenerate')?.addEventListener('click', () => { seed++; drawTiles(); });
  drawTiles();

})();
