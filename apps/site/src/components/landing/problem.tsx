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
    <section className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
      <SectionHeading eyebrow={t.problemEyebrow} title={t.problemHeading} sub={t.problemSub} />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item.title} className="h-full">
            <SpotlightCard className="h-full">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold tracking-widest text-indigo-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <item.icon className="size-5 text-fd-muted-foreground" />
              </div>
              <h3 className="mt-6 font-display text-xl font-medium tracking-tight">
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
