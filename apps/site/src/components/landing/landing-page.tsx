import { Cta } from './cta';
import { Ecosystem } from './ecosystem';
import { Faq } from './faq';
import { Features } from './features';
import { Hero } from './hero';
import { Problem } from './problem';
import { SiteFooter } from './site-footer';
import { Stats } from './stats';

/**
 * Full landing page composition. `lang` drives every string via the shared
 * translations dictionary. The smooth-scroll + fixed nav live on the outer
 * `LandingShell`; this component owns only the narrated sections, so it is
 * usable inside any layout.
 */
export function LandingPage({ lang }: { lang: string }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <Hero lang={lang} />
      <Problem lang={lang} />
      <Features lang={lang} />
      <Stats lang={lang} />
      <Ecosystem lang={lang} />
      <Faq lang={lang} />
      <Cta lang={lang} />
      <SiteFooter lang={lang} />
    </div>
  );
}
