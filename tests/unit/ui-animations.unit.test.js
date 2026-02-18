import { afterEach, describe, expect, it, vi } from 'vitest';
import { initGsapAnimations } from '../../js/ui-animations.js';

function makeSection() {
  return { style: {} };
}

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.gsap;
  delete globalThis.ScrollTrigger;
});

describe('ui animations', () => {
  it('falls back to static sections when reduced motion is preferred', () => {
    const sections = [makeSection(), makeSection()];
    const addEventListener = vi.fn();
    globalThis.window = {
      matchMedia: vi.fn(() => ({ matches: true })),
      addEventListener,
      scrollY: 0,
    };
    globalThis.document = {
      querySelectorAll: vi.fn(() => sections),
      querySelector: vi.fn(() => null),
      body: { classList: { toggle: vi.fn() } },
    };

    initGsapAnimations();

    expect(sections[0].style.opacity).toBe('1');
    expect(sections[0].style.transform).toBe('none');
    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });

  it('initializes gsap and scroll triggers when motion is allowed', () => {
    const sections = [makeSection(), makeSection(), makeSection()];
    const scrollCreate = vi.fn();
    const timelineTo = vi.fn();
    const timeline = { to: timelineTo };
    timelineTo.mockReturnValue(timeline);

    globalThis.window = {
      matchMedia: vi.fn(() => ({ matches: false })),
      addEventListener: vi.fn(),
      scrollY: 20,
    };
    globalThis.document = {
      querySelectorAll: vi.fn(() => sections),
      querySelector: vi.fn(() => ({ style: {} })),
      body: { classList: { toggle: vi.fn() } },
    };
    globalThis.ScrollTrigger = {
      create: scrollCreate,
    };
    globalThis.gsap = {
      registerPlugin: vi.fn(),
      to: vi.fn(),
      timeline: vi.fn(() => timeline),
    };

    initGsapAnimations();

    expect(globalThis.gsap.registerPlugin).toHaveBeenCalledWith(globalThis.ScrollTrigger);
    expect(globalThis.gsap.to).toHaveBeenCalled();
    expect(scrollCreate).toHaveBeenCalledTimes(sections.length);
  });
});
