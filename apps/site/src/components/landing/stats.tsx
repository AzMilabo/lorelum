import CountUp from '@/components/react-bits/count-up';
import { getStrings, type LandingStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

const STATS: Array<{
  value: number;
  suffix: string;
  labelKey: keyof LandingStrings;
}> = [
  { value: 1, suffix: '', labelKey: 'stats1Label' },
  { value: 2, suffix: '', labelKey: 'stats2Label' },
  { value: 100, suffix: '%', labelKey: 'stats3Label' },
];

export function Stats({ lang }: { lang: string }) {
  const t = getStrings(lang);
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
      <SectionHeading eyebrow={t.statsEyebrow} title={t.statsHeading} />
      <div className="mt-16 grid gap-12 sm:grid-cols-3">
        {STATS.map((stat) => (
          <Reveal key={stat.labelKey} className="text-center">
            <div className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text font-display text-6xl font-medium tracking-tight text-transparent sm:text-7xl">
              <CountUp to={stat.value} duration={1.8} />
              {stat.suffix}
            </div>
            <p className="mt-3 text-sm text-fd-muted-foreground">{t[stat.labelKey]}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
