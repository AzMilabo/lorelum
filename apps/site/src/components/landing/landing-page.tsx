import { AuroraBackground } from './aurora-background';
import { CursorGlow } from './cursor-glow';
import { Cta } from './cta';
import { Ecosystem } from './ecosystem';
import { Faq } from './faq';
import { Features } from './features';
import { Hero } from './hero';
import { LenisScroll } from './lenis-scroll';
import { Problem } from './problem';
import { SiteFooter } from './site-footer';
import { Stats } from './stats';

/**
 * Full landing page composition rendered inside the Fumadocs HomeLayout.
 * `lang` drives every string via the shared translations dictionary.
 *
 * The whole page is wrapped in Lenis smooth scrolling (landing only); docs
 * pages render their own layout without this wrapper.
 */
export function LandingPage({ lang }: { lang: string }) {
  return (
    <LenisScroll>
      <div className="relative flex flex-1 flex-col dark:bg-[#03040a]">
        <AuroraBackground />
        <CursorGlow />
        <Hero lang={lang} />
        <Problem lang={lang} />
        <Features lang={lang} />
        <Stats lang={lang} />
        <Ecosystem lang={lang} />
        <Faq lang={lang} />
        <Cta lang={lang} />
        <SiteFooter lang={lang} />
      </div>
    </LenisScroll>
  );
}
