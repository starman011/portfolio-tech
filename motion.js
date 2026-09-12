/* Progressive enhancement: content and controls do not depend on animation. */
(() => {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  document.body.classList.add('motion-enhanced');
  const preferences = gsap.matchMedia();
  preferences.add('(prefers-reduced-motion: no-preference)', () => {
    const field = document.querySelector('#surface-instrument');
    gsap.from('.scene-heading, .field-introduction, .scene-enter, .scene-dock', {
      y: 12, opacity: 0, duration: .85, stagger: .09, ease: 'power3.out', clearProps: 'opacity,transform'
    });
    const aura = gsap.timeline({ repeat: -1, yoyo: true, paused: true })
      .to('.aura-light-a', { xPercent: 15, yPercent: -12, duration: 12, ease: 'sine.inOut' }, 0)
      .to('.aura-light-b', { xPercent: -12, yPercent: 15, duration: 15, ease: 'sine.inOut' }, 0)
      .to('.aura-light-c', { xPercent: -14, yPercent: -10, duration: 14, ease: 'sine.inOut' }, 0);
    let visible = true;
    const sync = event => {
      if (event?.detail) visible = event.detail.playing;
      aura.paused(!visible || field.dataset.playing !== 'true' || document.hidden);
    };
    document.addEventListener('portfolio:field-state', sync);
    document.addEventListener('visibilitychange', sync);
    const off = () => aura.pause();
    window.addEventListener('pagehide', off);
    sync();
    gsap.to('.surface-stage', {
      y: 55, opacity: .25, ease: 'none',
      scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom 15%', scrub: .7 }
    });
    const sections = gsap.utils.toArray('#path, #work > .section-head, .project-grid > .feature, #research .research-grid, #about, #contact');
    sections.forEach(section => {
      gsap.from(section, {
        y: 36, opacity: .2, duration: 1.05, ease: 'power3.out', clearProps: 'opacity,transform',
        scrollTrigger: { trigger: section, start: 'top 89%', once: true }
      });
    });
    gsap.utils.toArray('.feature-layout .motion-film').forEach(media => {
      gsap.from(media, {
        y: 25, scale: .97, ease: 'none',
        scrollTrigger: { trigger: media, start: 'top bottom', end: 'center center', scrub: .7 }
      });
    });
    return () => {
      document.removeEventListener('portfolio:field-state', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pagehide', off);
    };
  });
  preferences.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
    const link = document.querySelector('.scene-enter');
    const icon = link.querySelector('.enter-icon');
    const x = gsap.quickTo(icon, 'x', { duration: .45, ease: 'power3.out' });
    const y = gsap.quickTo(icon, 'y', { duration: .45, ease: 'power3.out' });
    const move = event => {
      const rect = link.getBoundingClientRect();
      x(Math.max(-7, Math.min(7, (event.clientX - rect.left - rect.width / 2) * .12)));
      y(Math.max(-7, Math.min(7, (event.clientY - rect.top - rect.height / 2) * .16)));
    };
    const reset = () => { x(0); y(0); };
    link.addEventListener('pointermove', move);
    link.addEventListener('pointerleave', reset);
    link.addEventListener('blur', reset);
    return () => {
      link.removeEventListener('pointermove', move);
      link.removeEventListener('pointerleave', reset);
      link.removeEventListener('blur', reset);
    };
  });
  let refreshFrame = null;
  const refresh = () => {
    if (refreshFrame !== null) return;
    refreshFrame = requestAnimationFrame(() => { refreshFrame = null; ScrollTrigger.refresh(); });
  };
  document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', refresh));
  document.querySelectorAll('img').forEach(img => img.addEventListener('load', refresh, { once: true }));
  document.fonts?.ready.then(refresh);
})();
