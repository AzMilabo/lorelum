import LogoLoop, { type LogoItem } from '@/components/react-bits/logo-loop';
import { getStrings } from '@/lib/translations';
import { Reveal } from './reveal';
import { SectionHeading } from './section-heading';

export function Ecosystem({ lang }: { lang: string }) {
  const t = getStrings(lang);
  const logos: LogoItem[] = t.ecosystemItems.map((name) => ({
    node: (
      <span className="whitespace-nowrap px-8 font-mono text-base text-fd-muted-foreground">
        {name}
      </span>
    ),
  }));

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-24 sm:py-32">
      <SectionHeading eyebrow={t.ecosystemEyebrow} title={t.ecosystemHeading} sub={t.ecosystemSub} />
      <Reveal delay={0.1} className="mt-14">
        <LogoLoop
          logos={logos}
          speed={24}
          pauseOnHover
          fadeOut
          fadeOutColor="var(--color-fd-background)"
          logoHeight={28}
          ariaLabel={t.ecosystemHeading}
        />
      </Reveal>
    </section>
  );
}
