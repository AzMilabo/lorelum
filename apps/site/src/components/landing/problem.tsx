import { Archive, EyeOff, ShieldAlert } from 'lucide-react';
import SpotlightCard from '@/components/react-bits/spotlight-card';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { ScrollParallax } from './scroll-parallax';
import { SectionHeading } from './section-heading';

/**
 * Problem — three restrained spotlight cards. Number + icon up top, a strong
 * title, one body paragraph. The cards stay visually light (translucent
 * surface, hairline border) so the section reads like Antigravity: content
 * floating on the background, not heavy boxes.
 */
export function Problem({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const drift = [26, 12, 20]; // per-column parallax amplitude
  const items = [
    { icon: ShieldAlert, title: t.problem1Title, body: t.problem1Body },
    { icon: Archive, title: t.problem2Title, body: t.problem2Body },
    { icon: EyeOff, title: t.problem3Title, body: t.problem3Body },
  ];

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
      <SectionHeading eyebrow={t.problemEyebrow} title={t.problemHeading} sub={t.problemSub} />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal key={item.title} className="h-full" delay={i * 100}>
              <ScrollParallax from={drift[i]} to={-drift[i]} className="h-full">
                <SpotlightCard className="group h-full bg-fd-card/40">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold tracking-widest text-indigo-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="inline-flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-cyan-400/15 text-fd-muted-foreground ring-1 ring-fd-border/50 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-4" />
                  </div>
                </div>
                <h3 className="mt-6 font-display text-xl font-medium tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">{item.body}</p>
                </SpotlightCard>
              </ScrollParallax>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
