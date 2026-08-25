import { FileText, Package, Server, Zap } from 'lucide-react';
import SpotlightCard from '@/components/react-bits/spotlight-card';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

export function Features({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const items = [
    { icon: FileText, title: t.feature1Title, body: t.feature1Body },
    { icon: Zap, title: t.feature2Title, body: t.feature2Body },
    { icon: Server, title: t.feature3Title, body: t.feature3Body },
    { icon: Package, title: t.feature4Title, body: t.feature4Body },
  ];

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
      <SectionHeading eyebrow={t.featuresEyebrow} title={t.featuresHeading} sub={t.featuresSub} />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.07} className="h-full">
            <SpotlightCard className="h-full">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold tracking-widest text-indigo-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <item.icon className="size-5 text-fd-muted-foreground" />
              </div>
              <h3 className="mt-6 font-display text-lg font-medium tracking-tight">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                {item.body}
              </p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
