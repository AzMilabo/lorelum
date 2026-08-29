import { TerminalDemo } from '@/components/terminal-demo';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { ScrollParallax } from './scroll-parallax';

export function TerminalShowcase({ lang }: { lang: string }) {
  const t = getStrings(lang);
  return (
    <Reveal className="mt-16 w-full" y={40} scale={0.97}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-display text-2xl font-medium tracking-tight sm:text-3xl">
          {t.terminalSectionTitle}
        </h2>
        <p className="mt-2 text-sm text-fd-muted-foreground">{t.terminalSectionSub}</p>
      </div>
      <div className="relative mx-auto mt-10 max-w-2xl overflow-x-clip">
        <ScrollParallax from={30} to={-30} className="pointer-events-none absolute inset-0">
          <div aria-hidden className="landing-terminal-glow" />
        </ScrollParallax>
        <div className="landing-float">
          <TerminalDemo locale={lang} />
        </div>
      </div>
    </Reveal>
  );
}
