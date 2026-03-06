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
      duration: 0.55,
      stagger: 0.1,
      ease: 'power2.out',
      delay: 0.1,
    });

    const heroH1 = document.querySelector('.hero-copy h1');
    if (heroH1) {
      if (typeof gsap.fromTo === 'function') {
        gsap.fromTo(
          heroH1,
          { y: 10, opacity: 0.3, letterSpacing: '0.06em' },
          { y: 0, opacity: 1, letterSpacing: '0', duration: 0.8, delay: 0.15, ease: 'power2.out' },
        );
      } else {
        gsap.to(heroH1, {
          y: 0,
          opacity: 1,
          letterSpacing: '0',
          duration: 0.8,
          delay: 0.15,
          ease: 'power2.out',
        });
      }
    }

    sections.forEach((el) => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
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
