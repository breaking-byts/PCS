export function initGsapAnimations() {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sections = document.querySelectorAll('[data-section]');

  if (prefersReducedMotion || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    sections.forEach((section) => {
      section.style.opacity = '1';
      section.style.transform = 'none';
    });
  } else {
    gsap.registerPlugin(ScrollTrigger);

    gsap.to(sections, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      delay: 0.1,
    });

    const heroH1 = document.querySelector('.hero-copy h1');
    if (heroH1) {
      const glitchTL = gsap.timeline({ delay: 0.8 });
      glitchTL
        .to(heroH1, {
          x: -2,
          y: 1,
          textShadow: '2px 0 #ff003c, -2px 0 #00fff2',
          duration: 0.08,
          ease: 'power4.in',
        })
        .to(heroH1, {
          x: 2,
          y: -1,
          textShadow: '-2px 0 #ff003c, 2px 0 #00fff2',
          duration: 0.08,
          ease: 'power4.out',
        })
        .to(heroH1, { x: -1, y: 2, duration: 0.06, ease: 'none' })
        .to(heroH1, { x: 0, y: 0, textShadow: 'none', duration: 0.1, ease: 'power2.out' });
    }

    sections.forEach((el) => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
        },
      });
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      document.body.classList.toggle('scrolled', window.scrollY > 40);
    },
    { passive: true },
  );
}
