import type { Database } from "bun:sqlite";

import type { EffectivePractice, PracticeSource } from "../model";
import { acquireMutationLock } from "../storage/mutation-lock";
import { openStoreDatabase } from "../storage/sqlite/database";
import { openLocalStore } from "./open";
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
 * (ADR 0007 §12). Sequencing is frozen by the ADR:
 *
 * 1. Cold open **first** ("normal install/upgrade/uninstall still go through
 *    open()", ADR 0007 §8): this converges leftover journals, verifies the
 *    manifest/SQLite tuple and artifacts, and throws `StoreRecoveryRequiredError`
 *    on any inconsistency — so a stale lock is only ever reclaimed after the
 *    store is known consistent ("reclaiming a lock never skips recovery").
 * 2. Acquire the lock, then re-run the recovery check inside the lock to
 *    close the window between step 1 and acquisition.
 *
 * The lock and the database handle are always released, even when `run`
 * throws.
 */
export async function withStoreMutation<T>(
  rootPath: string,
  run: (context: MutationContext) => Promise<T>,
  options: MutationLockOptions = {},
): Promise<T> {
  // Step 1 — cold open without the lock (recovery check + stale-lock reclaim
  // authority; throws StoreRecoveryRequiredError on inconsistency).
  await openLocalStore(rootPath);

  // Step 2 — acquire (a stale lock is now reclaimable: recovery already ran
  // and the store is consistent), then re-converge under the lock.
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
