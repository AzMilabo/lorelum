import { AuroraBackground } from './aurora-background';
import { Cta } from './cta';
import { Ecosystem } from './ecosystem';
import { Features } from './features';
import { Hero } from './hero';
import { Problem } from './problem';
import { SiteFooter } from './site-footer';
import { Stats } from './stats';

/**
 * Full landing page composition rendered inside the Fumadocs HomeLayout.
 * `lang` drives every string via the shared translations dictionary.
 */
export function LandingPage({ lang }: { lang: string }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <AuroraBackground />
      <Hero lang={lang} />
      <Problem lang={lang} />
      <Features lang={lang} />
      <Stats lang={lang} />
      <Ecosystem lang={lang} />
      <Cta lang={lang} />
      <SiteFooter lang={lang} />
    </div>
  );
}
