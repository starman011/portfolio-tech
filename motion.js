/* Progressive enhancement: content and controls do not depend on animation. */
(() => {
  const { gsap } = window;
  if (!gsap) return;
  document.body.classList.add('motion-enhanced');
  const preferences = gsap.matchMedia();
  preferences.add('(prefers-reduced-motion: no-preference)', () => {
    const field = document.querySelector('#surface-instrument');
    gsap.from('.scene-heading, .field-introduction, .scene-enter, .scene-tools', {
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
    // Observe entry without ever writing the document's scroll position.
    // ScrollTrigger.refresh() temporarily scrolled to zero on image loads and
    // disclosure toggles. Neither is needed for these unpinned entrances.
    const entrances = new Set();
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const visual = entry.target.matches('.motion-film, .project-visual');
        const tween = gsap.fromTo(entry.target, { y: visual ? 26 : 16, scale: visual ? .975 : 1, opacity: .65 }, {
          y: 0, scale: 1, opacity: 1, duration: visual ? 1.15 : .85, delay: visual ? .08 : 0,
          ease: 'power3.out', clearProps: 'opacity,transform',
          onComplete: () => entrances.delete(tween)
        });
        entrances.add(tween);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 }) : null;
    gsap.utils.toArray('#path .statement-grid, #work > .section-head, .feature-copy, .motion-film, .project-visual, #research .research-grid, .about-intro, #contact > div').forEach(section => observer?.observe(section));
    return () => {
      observer?.disconnect();
      entrances.forEach(tween => tween.progress(1).kill());
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
})();
