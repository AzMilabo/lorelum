import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';

/**
 * Single registration point for the GSAP stack on the landing page.
 *
 * GSAP's ES modules are side-effect free at import time, so importing them
 * in a server component is safe; only the `registerPlugin` call needs a
 * browser. Keeping registration here means the plugins are registered
 * exactly once no matter how many landing components import them.
 */
let registered = false;

export function registerGsapPlugins() {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  registered = true;
}

export { gsap, ScrollTrigger, ScrollSmoother };
