import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { getStrings } from '@/lib/translations';

/**
 * A fixed-height, typewriter terminal demo for the landing page.
 *
 * Unlike the previous version (which appended lines forever and pushed the
 * hero text around), this renders a stable 4-row window:
 *
 *   1. the `lore query` command is typed character by character
 *   2. a short "retrieving" line with an animated ellipsis
 *   3. result lines slide in one at a time, the current one highlighted
 *   4. after a pause the window clears and replays from step 1
 *
 * The height never changes, so the landing hero stays put and the eye is
 * always drawn to the current line.
 *
 * `locale` picks the localized prompts and window title.
 */

interface DemoStep {
  /** Stable key so React can keep rows when text changes. */
  key: string;
  /** Left-aligned prefix chip, e.g. `✓`, `…`. */
  prefix?: string;
  /** Muted label for the row. */
  label?: string;
  /** The main text of the row. */
  text: string;
}

const TYPE_SPEED = 28; // ms per character
const STEP_DELAY = 650; // pause after a row completes
const REPLAY_DELAY = 1400; // pause after the last row before replaying

export function TerminalDemo({ locale = 'en' }: { locale?: string }) {
  const t = getStrings(locale);

  // phase: 'typing' | 'retrieving' | 'results' | 'paused'
  const [phase, setPhase] = useState<'typing' | 'retrieving' | 'results' | 'paused'>('typing');
  const [typedChars, setTypedChars] = useState(0);
  const [resultCount, setResultCount] = useState(0);

  const queryText = t.terminalQuery;
  const results: DemoStep[] = [
    { key: 'task', prefix: '✓', label: t.terminalTaskPrompt, text: t.terminalTask },
    {
      key: 'practice',
      prefix: '✓',
      label: t.terminalPracticesPrompt,
      text: t.terminalPracticesText,
    },
    { key: 'anti', prefix: '✓', label: t.terminalAntiPrompt, text: t.terminalAntiText },
  ];

  // Phase 1: type out the query character by character.
  useEffect(() => {
    if (phase !== 'typing') return;
    if (typedChars < queryText.length) {
      const id = setTimeout(() => setTypedChars((c) => c + 1), TYPE_SPEED);
      return () => clearTimeout(id);
    }
    // done typing → brief pause, then move to retrieving
    const id = setTimeout(() => setPhase('retrieving'), STEP_DELAY);
    return () => clearTimeout(id);
  }, [phase, typedChars, queryText.length]);

  // Phase 2: show a "retrieving" line briefly.
  useEffect(() => {
    if (phase !== 'retrieving') return;
    const id = setTimeout(() => setPhase('results'), 900);
    return () => clearTimeout(id);
  }, [phase]);

  // Phase 3: reveal result rows one at a time.
  useEffect(() => {
    if (phase !== 'results') return;
    if (resultCount < results.length) {
      const id = setTimeout(() => setResultCount((c) => c + 1), 900);
      return () => clearTimeout(id);
    }
    // all results shown → pause, then reset & replay
    const id = setTimeout(() => setPhase('paused'), REPLAY_DELAY);
    return () => clearTimeout(id);
  }, [phase, resultCount, results.length]);

  // Phase 4: reset everything and replay.
  useEffect(() => {
    if (phase !== 'paused') return;
    setTypedChars(0);
    setResultCount(0);
    setPhase('typing');
  }, [phase]);

  const typingText = queryText.slice(0, typedChars);
  const showCursor = phase === 'typing' || phase === 'retrieving';

  return (
    <div className="mx-auto mt-10 w-full max-w-2xl text-left">
      <div className="overflow-hidden rounded-2xl border border-fd-border bg-gradient-to-b from-fd-secondary/80 to-fd-secondary/40 shadow-xl shadow-fd-primary/5">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-fd-border/70 bg-fd-background/60 px-4 py-2.5 backdrop-blur">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-fd-muted-foreground">
            {t.terminalWindowTitle}
          </span>
          <span className="ml-auto rounded-md bg-fd-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-fd-primary">
            lore
          </span>
        </div>

        {/* Fixed-height terminal body (4 rows) so the hero never shifts. */}
        <div className="h-[9.5rem] px-5 py-4 font-mono text-sm leading-7">
          {/* Row 1: the typed query */}
          <div className="flex items-baseline gap-2">
            <span className="text-fd-muted-foreground">$</span>
            <span className="text-fd-foreground">{typingText}</span>
            {showCursor && (
              <span className="inline-block h-4 w-2 animate-pulse bg-fd-primary align-middle" />
            )}
          </div>

          {/* Row 2: retrieving indicator (only during typing/retrieving) */}
          {(phase === 'retrieving' || (phase === 'typing' && typedChars === queryText.length)) && (
            <div className="flex items-center gap-2 text-fd-muted-foreground">
              <span className="animate-pulse">…</span>
              <span>{t.terminalRetrieving}</span>
            </div>
          )}

          {/* Rows 3+: revealed results, newest highlighted */}
          {phase !== 'typing' &&
            results.slice(0, resultCount).map((r, i) => {
              const isNewest = i === resultCount - 1 && phase === 'results';
              return (
                <div
                  key={r.key}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-2 py-0.5 -mx-2 transition-colors',
                    isNewest && 'bg-fd-primary/10 text-fd-foreground',
                  )}
                >
                  <span className={cn('mt-0.5', isNewest ? 'text-fd-primary' : 'text-fd-muted-foreground')}>
                    {r.prefix}
                  </span>
                  <span className="text-fd-muted-foreground">{r.label}</span>
                  <span className="truncate text-fd-foreground/80">{r.text}</span>
                </div>
              );
            })}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-fd-muted-foreground">{t.terminalCaption}</p>
    </div>
  );
}
