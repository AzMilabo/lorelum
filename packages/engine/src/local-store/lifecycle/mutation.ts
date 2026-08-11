import type { Database } from "bun:sqlite";

import type { EffectivePractice, PracticeSource } from "../model";
import { acquireMutationLock } from "../storage/mutation-lock";
import { openStoreDatabase } from "../storage/sqlite/database";
import { runStoreRecovery, type RecoveryResult } from "./recovery";
import type { EffectiveRevisionHook } from "./types";

export interface MutationContext {
  database: Database;
  recovery: RecoveryResult;
}

export interface MutationLockOptions {
  /** Bounded wait for a held lock before StoreBusyError (default 5s). */
  waitMs?: number;
}

/**
 * Materialize the active source set from the materialized snapshot. The
 * reader already re-canonicalized every row, so the sources handed to the
 * pure merge rules are trusted.
 */
export function activeSources(effectivePractices: readonly EffectivePractice[]): readonly PracticeSource[] {
  return effectivePractices.flatMap((practice) => practice.sources);
}

/**
 * Run one manifest-mutating operation under the cross-process mutation lock
 * (ADR 0007 §12): acquire the lock, open + migrate SQLite, converge leftover
 * journal records, then hand a consistent context to `run`. The lock and the
 * database handle are always released, even when `run` throws.
 */
export async function withStoreMutation<T>(
  rootPath: string,
  run: (context: MutationContext) => Promise<T>,
  options: MutationLockOptions = {},
): Promise<T> {
  const lock = await acquireMutationLock(rootPath, {
    ...(options.waitMs === undefined ? {} : { waitMs: options.waitMs }),
  });
  const database = await openStoreDatabase(rootPath);
  try {
    const recovery = await runStoreRecovery(rootPath, database);
    return await run({ database, recovery });
  } finally {
    database.close();
    await lock.release();
  }
}

/** Invoke the post-commit vector hook (ADR 0007 §4); never throws. */
export async function notifyRevision(
  hook: EffectiveRevisionHook | undefined,
  revision: number,
  delta: Parameters<EffectiveRevisionHook>[1],
): Promise<{ revision: number; error: unknown } | undefined> {
  if (hook === undefined) return undefined;
  try {
    await hook(revision, delta);
    return undefined;
  } catch (error) {
    return { revision, error };
  }
}
