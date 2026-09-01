import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { LanguageSwitch } from '@/components/language-switch';
import { i18n } from '@/lib/i18n';
import { appName, gitConfig } from '@/lib/shared';
import { AuroraBackground } from './aurora-background';
import { CursorGlow } from './cursor-glow';
import { CustomCursor } from './custom-cursor';
import {
  SmoothScroll,
  SMOOTH_CONTENT_ID,
  SMOOTH_WRAPPER_ID,
} from './smooth-scroll';

/**
 * Landing-page shell, replacing Fumadocs `HomeLayout` on the marketing route
 * only (docs keep `DocsLayout`).
 *
 * Antigravity ships a fixed header outside its ScrollSmoother content because
 * `position: sticky/fixed` inside a transformed scroll container stops
 * behaving like the natively-scrolled page. We mirror that: the brand/nav is
 * a fixed sibling of `#smooth-content`, so ScrollSmoother never transforms it
 * and the theme/language switches stay reachable while scrolling.
 */
export function LandingShell({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  const homePath = lang === i18n.defaultLanguage ? '/' : `/${lang}`;
  const github = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-fd-border/60 bg-fd-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-4">
          <Link
            to={homePath}
            className="inline-flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight"
          >
            {appName}
          </Link>

          <div className="flex items-center gap-1.5">
            <LanguageSwitch />
            <ThemeSwitch />
            <a
              href={github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="inline-flex size-8 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
              </svg>
            </a>
          </div>
        </div>
      </nav>

      {/* Fixed/ambient layers must live outside the translated scroll content
          so ScrollSmoother never turns their `position: fixed` into a
          transform-relative one. */}
      <AuroraBackground />
      <CursorGlow />
      <CustomCursor />

      <SmoothScroll>
        <div id={SMOOTH_WRAPPER_ID} className="relative w-full">
          <div id={SMOOTH_CONTENT_ID}>{children}</div>
        </div>
      </SmoothScroll>
    </>
  );
}
