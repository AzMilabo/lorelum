import { TerminalDemo } from '@/components/terminal-demo';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';

export function TerminalShowcase({ lang }: { lang: string }) {
  const t = getStrings(lang);
  return (
    <Reveal delay={0.1} className="mt-16 w-full">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance font-display text-2xl font-medium tracking-tight sm:text-3xl">
          {t.terminalSectionTitle}
        </h2>
        <p className="mt-2 text-sm text-fd-muted-foreground">{t.terminalSectionSub}</p>
      </div>
      <div className="relative mx-auto mt-10 max-w-2xl overflow-x-clip">
        <div aria-hidden className="landing-terminal-glow" />
        <div className="landing-ring rounded-2xl p-px">
          <TerminalDemo locale={lang} />
        </div>
      </div>
    </Reveal>
  );
}


