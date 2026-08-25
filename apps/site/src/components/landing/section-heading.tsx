import { Reveal } from './reveal';

export function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text font-display text-xs font-semibold uppercase tracking-[0.25em] text-transparent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-4 text-balance font-display text-4xl font-medium tracking-tight sm:text-5xl">
        {title}
      </h2>
      {sub ? (
        <p className="mt-5 text-balance text-base text-fd-muted-foreground sm:text-lg">
          {sub}
        </p>
      ) : null}
    </Reveal>
  );
}
