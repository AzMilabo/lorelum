import { FileText, Package, Server, Zap } from 'lucide-react';
import SpotlightCard from '@/components/react-bits/spotlight-card';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { ScrollParallax } from './scroll-parallax';
import { SectionHeading } from './section-heading';

/**
 * Features — an asymmetric bento so the section has rhythm instead of a
 * uniform card wall. The two wide cards get a horizontal layout; the two
 * narrow ones stay vertical. All cards share the same spotlight hover.
 */
export function Features({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const drift = [24, 12, 16, 28]; // per-card parallax amplitude
  const items = [
    { icon: FileText, title: t.feature1Title, body: t.feature1Body, wide: true },
    { icon: Zap, title: t.feature2Title, body: t.feature2Body, wide: false },
    { icon: Server, title: t.feature3Title, body: t.feature3Body, wide: false },
    { icon: Package, title: t.feature4Title, body: t.feature4Body, wide: true },
  ];

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
      <SectionHeading eyebrow={t.featuresEyebrow} title={t.featuresHeading} sub={t.featuresSub} />
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal
              key={item.title}
              className={item.wide ? 'lg:col-span-2' : 'lg:col-span-1'}
              delay={i * 110}
            >
              <ScrollParallax from={drift[i % 4]} to={-drift[i % 4]} className="h-full">
                <SpotlightCard className="group h-full">
                <div className={item.wide ? 'flex h-full flex-col gap-5 sm:flex-row sm:items-start' : ''}>
                  <div
                    className="landing-icon inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-cyan-400/20 text-fd-foreground ring-1 ring-fd-border/60"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span aria-hidden className="landing-icon-halo" />
                    <Icon
                      className="landing-icon-glyph size-5 text-indigo-400"
                      style={{ animationDelay: `${i * 90}ms` }}
                    />
                  </div>
                  <div className={item.wide ? 'sm:pt-0.5' : 'mt-5'}>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xs font-semibold tracking-widest text-indigo-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-display text-lg font-medium tracking-tight">{item.title}</h3>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-fd-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
                </SpotlightCard>
              </ScrollParallax>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
