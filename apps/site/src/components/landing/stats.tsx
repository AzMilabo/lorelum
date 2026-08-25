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
    <section className="relative mx-auto w-full max-w-6xl px-4 py-20">
      <SectionHeading eyebrow={t.statsEyebrow} title={t.statsHeading} />
      <div className="mt-12 grid gap-8 sm:grid-cols-3">
        {STATS.map((stat, i) => (
          <Reveal key={stat.labelKey} delay={i * 0.08} className="text-center">
            <div className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">
              <CountUp to={stat.value} duration={1.8} />
              {stat.suffix}
            </div>
            <p className="mt-2 text-sm text-fd-muted-foreground">{t[stat.labelKey]}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
