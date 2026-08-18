import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { getStrings } from '@/lib/translations';

/**
 * Steps rendered as a typing terminal demo on the landing page.
 *
 * TanStack Start hydrates this component on the client, so the typing
 * animation only runs after hydration (no SSR/LCP cost from the loop).
 * `locale` picks the localized prompts and window title.
 */
export function TerminalDemo({ locale = 'en' }: { locale?: string }) {
  const t = getStrings(locale);
  const [step, setStep] = useState(0);

  const steps = [
    { label: 'query', prompt: t.terminalQuery, text: 'agent-query' },
    { label: 'task', prompt: t.terminalTaskPrompt, text: t.terminalTask },
    { label: 'practices', prompt: t.terminalPracticesPrompt, text: t.terminalPracticesText },
    { label: 'anti', prompt: t.terminalAntiPrompt, text: t.terminalAntiText },
  ];

  useEffect(() => {
    // Advance one step every 1.2s; wrap around so the demo stays lively.
    const id = setInterval(() => setStep((s) => (s + 1) % steps.length), 1200);
    return () => clearInterval(id);
  }, [steps.length]);

  const visible = steps.slice(0, step + 1);

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl text-left">
      <div className="rounded-xl border border-fd-border bg-fd-secondary/60 shadow-sm">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-fd-border px-4 py-2.5">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-yellow-400/80" />
          <span className="size-3 rounded-full bg-green-400/80" />
          <span className="ml-3 font-mono text-xs text-fd-muted-foreground">
            {t.terminalWindowTitle}
          </span>
        </div>

        {/* Typed output */}
        <div className="px-5 py-4 font-mono text-sm leading-relaxed">
          {visible.map((s, i) => {
            const isCurrent = i === visible.length - 1;
            return (
              <div key={s.label + i} className={cn('py-1', isCurrent && 'animate-pulse')}>
                <span className="text-fd-muted-foreground">{s.prompt}</span>
                <span className="text-fd-primary">{s.text}</span>
              </div>
            );
          })}
          <span className="inline-block h-4 w-2 animate-pulse bg-fd-primary align-middle" />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-fd-muted-foreground">{t.terminalCaption}</p>
    </div>
  );
}
