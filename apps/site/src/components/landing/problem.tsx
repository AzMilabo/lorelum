import { Archive, EyeOff, ShieldAlert } from 'lucide-react';
import SpotlightCard from '@/components/react-bits/spotlight-card';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

export function Problem({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const items = [
    { icon: ShieldAlert, title: t.problem1Title, body: t.problem1Body },
    { icon: Archive, title: t.problem2Title, body: t.problem2Body },
    { icon: EyeOff, title: t.problem3Title, body: t.problem3Body },
  ];

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-20">
      <SectionHeading title={t.problemHeading} sub={t.problemSub} />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.08} className="h-full">
            <SpotlightCard className="h-full">
              <item.icon className="size-6 text-fd-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
                {item.body}
              </p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
