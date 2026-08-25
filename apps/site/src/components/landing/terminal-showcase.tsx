import { TerminalDemo } from '@/components/terminal-demo';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';

export function TerminalShowcase({ lang }: { lang: string }) {
  const t = getStrings(lang);
  return (
    <Reveal delay={0.1} className="mt-16 w-full">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
          {t.terminalSectionTitle}
        </h2>
        <p className="mt-2 text-sm text-fd-muted-foreground">{t.terminalSectionSub}</p>
      </div>
      <TerminalDemo locale={lang} />
    </Reveal>
  );
}
