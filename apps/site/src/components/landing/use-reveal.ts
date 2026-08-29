import { useEffect, useRef, useState } from 'react';

/**
 * Shared "reveal on view" logic used by `Reveal` and `SplitReveal`.
 *
 * SSR-safe: the element starts visible in the HTML (no flash, no invisible
 * content for no-JS), and after hydration only elements below the fold hide
 * and wait for the IntersectionObserver. One-shot: the observer disconnects
 * after firing. Reduced motion keeps everything visible immediately.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, visible };
}
