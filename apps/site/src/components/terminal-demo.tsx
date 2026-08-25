import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { getStrings } from '@/lib/translations';

/**
 * A fixed-height, typewriter terminal demo for the landing page.
 *
 * The window is a stable block that never changes height:
 *
 *   1. the `lore query` command is typed character by character
 *   2. a short "retrieving" line with an animated ellipsis
 *   3. result rows slide in one at a time as two-line cards (label + value)
 *   4. after a pause the window clears and replays from step 1
 *
 * Each result is rendered as its own two-line block so long Practice ids
 * (e.g. `testing.tests-as-cheerleaders-for-implementation`) always render
 * in full instead of being clipped by the window width.
 *
 * `locale` picks the localized prompts and window title.
 */

interface DemoResult {
  /** Stable key so React can keep rows when text changes. */
  key: string;
  /** Short muted label, e.g. "3 relevant Practices". */
  label: string;
  /** The full value shown on its own line, never truncated. */
  text: string;
}

const TYPE_SPEED = 28; // ms per character
const STEP_DELAY = 620; // pause after a row completes
const REPLAY_DELAY = 1400; // pause after the last row before replaying

export function TerminalDemo({ locale = 'en' }: { locale?: string }) {
  const t = getStrings(locale);

  // phase: 'typing' | 'retrieving' | 'results' | 'paused'
  const [phase, setPhase] = useState<'typing' | 'retrieving' | 'results' | 'paused'>('typing');
  const [typedChars, setTypedChars] = useState(0);
  const [resultCount, setResultCount] = useState(0);

  const queryText = t.terminalQuery;
  const results: DemoResult[] = [
    { key: 'task', label: t.terminalTaskPrompt, text: t.terminalTask },
    { key: 'practice', label: t.terminalPracticesPrompt, text: t.terminalPracticesText },
    { key: 'anti', label: t.terminalAntiPrompt, text: t.terminalAntiText },
  ];

  // Phase 1: type out the query character by character.
  useEffect(() => {
    if (phase !== 'typing') return;
    if (typedChars < queryText.length) {
      const id = setTimeout(() => setTypedChars((c) => c + 1), TYPE_SPEED);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase('retrieving'), STEP_DELAY);
    return () => clearTimeout(id);
  }, [phase, typedChars, queryText.length]);

  // Phase 2: show a "retrieving" line briefly.
  useEffect(() => {
    if (phase !== 'retrieving') return;
    const id = setTimeout(() => setPhase('results'), 850);
    return () => clearTimeout(id);
  }, [phase]);

  // Phase 3: reveal result rows one at a time.
  useEffect(() => {
    if (phase !== 'results') return;
    if (resultCount < results.length) {
      const id = setTimeout(() => setResultCount((c) => c + 1), 950);
      return () => clearTimeout(id);
    }
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
  const showRetrieving =
    phase === 'retrieving' || (phase === 'typing' && typedChars === queryText.length);
  const resultBlocks = phase !== 'typing' ? results.slice(0, resultCount) : [];

  return (
    <div className="w-full text-left">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-fd-secondary/80 to-fd-secondary/40 shadow-xl shadow-fd-primary/5">
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

        {/*
          Fixed-height terminal body.

          Stable content rows (query + retrieving) = 2.
          Up to 3 result cards; each card = label row + value row + vertical padding.
          We reserve height for 3 cards so the window never grows/shrinks while
          results stream in.
        */}
        <div className="h-[17rem] px-5 py-4 font-mono text-sm leading-7">
          {/* Row 1: the typed query */}
          <div className="flex items-baseline gap-2">
            <span className="text-fd-muted-foreground">$</span>
            <span className="text-fd-foreground">{typingText}</span>
            {showCursor && (
              <span className="inline-block h-4 w-2 animate-pulse bg-fd-primary align-middle" />
            )}
          </div>

          {/* Row 2: retrieving indicator */}
          {showRetrieving && (
            <div className="flex items-center gap-2 text-fd-muted-foreground">
              <span className="animate-pulse">…</span>
              <span>{t.terminalRetrieving}</span>
            </div>
          )}

          {/* Result cards: label (with check) + full value on its own line */}
          {resultBlocks.map((r, i) => {
            const current = phase === 'results' && i === resultCount - 1;
            return (
              <div
                key={r.key}
                className={cn(
                  '-mx-2 mt-1 rounded-lg border px-2 py-1 transition-colors',
                  current
                    ? 'border-fd-primary/30 bg-fd-primary/10'
                    : 'border-transparent',
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 text-xs',
                    current ? 'text-fd-primary' : 'text-fd-muted-foreground',
                  )}
                >
                  <span className="font-medium">✓</span>
                  <span>{r.label}</span>
                </div>
                {/* Value line: full width, word-wrap so long ids never clip */}
                <div className="pl-5 text-fd-foreground/85">{r.text}</div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-fd-muted-foreground">{t.terminalCaption}</p>
    </div>
  );
}

