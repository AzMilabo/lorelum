import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Steps rendered as a typing terminal demo on the landing page.
 *
 * TanStack Start hydrates this component on the client, so the typing
 * animation only runs after hydration (no SSR/LCP cost from the loop).
 */
const STEPS: Array<{ label: string; prompt: string; text: string }> = [
  {
    label: 'Query',
    prompt: '$ lore query',
    text: 'agent-query',
  },
  {
    label: 'Task',
    prompt: 'task: building the RBAC admin panel',
    text: 'moment: about to claim the whole capability is done',
  },
  {
    label: 'Retrieved',
    prompt: '3 relevant Practices',
    text: 'verification.match-claims-to-evidence',
  },
  {
    label: 'Retrieved',
    prompt: '2 anti-patterns',
    text: 'testing.tests-as-cheerleaders-for-implementation',
  },
];

export function TerminalDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Advance one step every 1.2s; wrap around so the demo stays lively.
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1200);
    return () => clearInterval(id);
  }, []);

  const visible = STEPS.slice(0, step + 1);

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl text-left">
      <div className="rounded-xl border border-fd-border bg-fd-secondary/60 shadow-sm">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-fd-border px-4 py-2.5">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-yellow-400/80" />
          <span className="size-3 rounded-full bg-green-400/80" />
          <span className="ml-3 font-mono text-xs text-fd-muted-foreground">lore — interactive</span>
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

      <p className="mt-3 text-center text-xs text-fd-muted-foreground">
        A client-hydrated terminal demo — the query loop runs only after React hydrates.
      </p>
    </div>
  );
}
