import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { StoreBusyError } from "./errors";

export const LOCK_FILE_NAME = ".lock";

export interface MutationLockRecord {
  pid: number;
  startedAt: string;
}

/** True when a live process answers for `pid` (EPERM means it exists). */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EPERM") {
      return true;
    }
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Decode a lock file without trusting arbitrary bytes on disk. */
export function parseLockRecord(text: string, path: string): MutationLockRecord {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new StoreBusyError(`lock file ${path} is not valid JSON`, error);
  }
  if (
    !isRecord(value) ||
    typeof value.pid !== "number" ||
    !Number.isSafeInteger(value.pid) ||
    value.pid <= 0 ||
    typeof value.startedAt !== "string" ||
    Number.isNaN(Date.parse(value.startedAt))
  ) {
    throw new StoreBusyError(`lock file ${path} has an unsupported shape`);
  }
  return Object.freeze({ pid: value.pid, startedAt: value.startedAt });
}

export function lockPath(rootPath: string): string {
  return join(rootPath, LOCK_FILE_NAME);
}

export interface MutationLockHandle {
  /** Remove the lock only if this handle still owns it. */
  release(): Promise<void>;
}

export interface AcquireLockOptions {
  /** Total time to wait for a held lock before failing with StoreBusyError. */
  waitMs?: number;
  /** How often to re-attempt creation while waiting. */
  pollIntervalMs?: number;
}

const DEFAULT_WAIT_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 50;

async function tryCreateLock(
  rootPath: string,
): Promise<MutationLockHandle | { held: MutationLockRecord } | "stale"> {
  const path = lockPath(rootPath);
  const record: MutationLockRecord = { pid: process.pid, startedAt: new Date().toISOString() };
  try {
    // "wx" creates the lock file atomically and fails with EEXIST when a lock
    // is held — create-or-fail, never clobber.
    await writeFile(path, JSON.stringify(record), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    // "wx" fails with EEXIST when the lock is held; anything else is a real
    // storage problem surfaced as StoreBusyError (never a silent retry loop).
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (readError) {
        if (
          typeof readError === "object" &&
          readError !== null &&
          "code" in readError &&
          readError.code === "ENOENT"
        ) {
          // The holder released between our failed create and this read;
          // report stale so the caller retries creation immediately.
          return "stale";
        }
        throw new StoreBusyError(`cannot read lock file ${path}`, readError);
      }
      const held = parseLockRecord(text, path);
      return isProcessAlive(held.pid) ? { held } : "stale";
    }
    throw new StoreBusyError(`cannot acquire mutation lock at ${path}`, error);
  }

  return {
    release: async () => {
      // Delete only while this handle still owns the file — a stale reclaim
      // or a future holder must never be clobbered by an old release.
      try {
        const current = await readFile(path, "utf8");
        const currentRecord = parseLockRecord(current, path);
        if (currentRecord.pid === record.pid && currentRecord.startedAt === record.startedAt) {
          await unlink(path);
        }
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return; // already gone; release is idempotent
        }
        throw new StoreBusyError(`cannot release mutation lock at ${path}`, error);
      }
    },
  };
}

/**
 * Acquire the per-StorageRoot cross-process mutation lock (ADR 0007 §12).
 * Mutations are exclusive; the read path never takes this lock. A lock whose
 * holder process is gone is reclaimed immediately — callers must have run the
 * operation-journal recovery check first (the lifecycle layer guarantees
 * this ordering).
 */
export async function acquireMutationLock(
  rootPath: string,
  options: AcquireLockOptions = {},
): Promise<MutationLockHandle> {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + waitMs;

  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- lock acquisition is a serial poll
    const attempt = await tryCreateLock(rootPath);
    if (attempt !== "stale" && !("held" in attempt)) return attempt;
    if (attempt === "stale") {
      // Reclaim a dead holder's lock and retry immediately.
      // eslint-disable-next-line no-await-in-loop -- stale reclaim must retry serially
      await unlink(lockPath(rootPath)).catch(() => undefined);
      continue;
    }
    if (Date.now() >= deadline) {
      throw new StoreBusyError(
        `mutation lock is held by pid ${attempt.held.pid} (started ${attempt.held.startedAt})`,
      );
    }
    // eslint-disable-next-line no-await-in-loop -- polling is inherently sequential
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
