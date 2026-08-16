import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { StoreBusyError } from "./errors";

export const LOCK_FILE_NAME = ".lock";

export interface MutationLockRecord {
  pid: number;
  startedAt: string;
  /** Holder process start time, used to distinguish PID reuse. */
  processStartedAt?: string;
  /** Random per-acquisition identity; absent only for legacy lock files. */
  ownerToken?: string;
}

interface ReclaimGuardRecord {
  target: MutationLockRecord;
  claimerPid: number;
  claimerStartedAt: string;
  claimerProcessStartedAt: string;
  claimerToken: string;
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

const CURRENT_PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1_000).toISOString();
const PROCESS_START_TOLERANCE_MS = 2_000;
const processStartCache = new Map<number, { checkedAt: number; startedAt: number | undefined }>();

async function queryProcessStartedAt(pid: number): Promise<number | undefined> {
  if (!isProcessAlive(pid)) return undefined;
  if (pid === process.pid) return Date.parse(CURRENT_PROCESS_STARTED_AT);
  const cached = processStartCache.get(pid);
  if (cached !== undefined && Date.now() - cached.checkedAt < 1_000) return cached.startedAt;
  try {
    const command =
      process.platform === "win32"
        ? [
            "powershell.exe",
            "-NoProfile",
            "-Command",
            `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().ToString('o')`,
          ]
        : ["ps", "-o", "lstart=", "-p", String(pid)];
    const child = Bun.spawn(command, { stdout: "pipe", stderr: "ignore" });
    const [exitCode, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
    const parsed = exitCode === 0 ? Date.parse(output.trim()) : Number.NaN;
    const startedAt = Number.isNaN(parsed) ? undefined : parsed;
    processStartCache.set(pid, { checkedAt: Date.now(), startedAt });
    return startedAt;
  } catch {
    return undefined;
  }
}

/** True only when the PID still names the process instance that wrote the record. */
async function isRecordedProcessAlive(record: MutationLockRecord): Promise<boolean> {
  if (!isProcessAlive(record.pid)) return false;
  if (record.processStartedAt === undefined) return true; // legacy, conservative
  const actualStartedAt = await queryProcessStartedAt(record.pid);
  if (actualStartedAt === undefined) return true; // platform query unavailable, conservative
  return (
    Math.abs(actualStartedAt - Date.parse(record.processStartedAt)) <= PROCESS_START_TOLERANCE_MS
  );
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
    Number.isNaN(Date.parse(value.startedAt)) ||
    (value.processStartedAt !== undefined &&
      (typeof value.processStartedAt !== "string" ||
        Number.isNaN(Date.parse(value.processStartedAt)))) ||
    (value.ownerToken !== undefined &&
      (typeof value.ownerToken !== "string" || value.ownerToken.length === 0))
  ) {
    throw new StoreBusyError(`lock file ${path} has an unsupported shape`);
  }
  return Object.freeze({
    pid: value.pid,
    startedAt: value.startedAt,
    ...(value.processStartedAt === undefined ? {} : { processStartedAt: value.processStartedAt }),
    ...(value.ownerToken === undefined ? {} : { ownerToken: value.ownerToken }),
  });
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

type ReclaimOutcome = "removed" | "gone" | "busy" | "changed";
type ReclaimClaim = "claimed" | "busy" | "changed";

function sameLockRecord(left: MutationLockRecord, right: MutationLockRecord): boolean {
  if (left.pid !== right.pid || left.startedAt !== right.startedAt) return false;
  // Legacy lock files have no owner token. The PID + timestamp tuple remains
  // their identity, while new files get the stronger random token check. Do
  // not let a new token-bearing handle release a legacy/replaced record with
  // the same tuple.
  if (left.ownerToken === undefined && right.ownerToken === undefined) return true;
  if (left.ownerToken === undefined || right.ownerToken === undefined) return false;
  return left.ownerToken === right.ownerToken;
}

function reclaimGuardPath(rootPath: string, record: MutationLockRecord): string {
  // UUIDs are already path-safe. Legacy records use the timestamp/PID tuple,
  // which is encoded so arbitrary bytes from a hand-written lock cannot escape
  // the storage root. A collision only makes reclaimers wait; it cannot make
  // one lock delete another because the guard contains and verifies `target`.
  const identity = record.ownerToken ?? `${record.pid}:${record.startedAt}`;
  const encoded = Buffer.from(identity, "utf8").toString("base64url");
  return join(rootPath, `.lock.reclaim.${encoded}`);
}

function makeReclaimGuard(record: MutationLockRecord): ReclaimGuardRecord {
  return {
    target: record,
    claimerPid: process.pid,
    claimerStartedAt: new Date().toISOString(),
    claimerProcessStartedAt: CURRENT_PROCESS_STARTED_AT,
    claimerToken: randomUUID(),
  };
}

function isReclaimGuardRecord(value: unknown): value is ReclaimGuardRecord {
  return (
    isRecord(value) &&
    isRecord(value.target) &&
    typeof value.claimerPid === "number" &&
    Number.isSafeInteger(value.claimerPid) &&
    value.claimerPid > 0 &&
    typeof value.claimerStartedAt === "string" &&
    !Number.isNaN(Date.parse(value.claimerStartedAt)) &&
    typeof value.claimerProcessStartedAt === "string" &&
    !Number.isNaN(Date.parse(value.claimerProcessStartedAt)) &&
    typeof value.claimerToken === "string" &&
    value.claimerToken.length > 0
  );
}

function parseReclaimGuard(text: string, path: string): ReclaimGuardRecord {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new StoreBusyError(`reclaim guard ${path} is not valid JSON`, error);
  }
  if (!isReclaimGuardRecord(value)) {
    throw new StoreBusyError(`reclaim guard ${path} has an unsupported shape`);
  }
  // Reuse the lock-record parser so malformed target fields remain a typed
  // StoreBusyError rather than being trusted during a destructive operation.
  const target = parseLockRecord(JSON.stringify(value.target), path);
  return Object.freeze({
    target,
    claimerPid: value.claimerPid,
    claimerStartedAt: value.claimerStartedAt,
    claimerProcessStartedAt: value.claimerProcessStartedAt,
    claimerToken: value.claimerToken,
  });
}

async function removeReclaimGuard(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true }).catch((error) => {
    throw new StoreBusyError(`cannot remove reclaim guard ${path}`, error);
  });
}

/**
 * Claim one stale lock identity. The guard is an atomically-created directory,
 * not a boolean check followed by unlink(.lock). Other reclaimers that saw the
 * same stale record therefore wait for the claimant and cannot remove a new
 * holder after the claimant has created it.
 */
async function claimReclaimGuard(
  rootPath: string,
  expected: MutationLockRecord,
): Promise<{ claim: ReclaimClaim; path: string; record?: ReclaimGuardRecord }> {
  const path = reclaimGuardPath(rootPath, expected);
  const record = makeReclaimGuard(expected);
  const temporaryPath = join(rootPath, `.lock.reclaim.tmp.${record.claimerToken}`);
  try {
    // Publish a complete guard atomically. A claimant crash before rename only
    // leaves a uniquely named temp directory and never blocks this identity;
    // readers can never observe a truncated record.json.
    await mkdir(temporaryPath);
    await writeFile(join(temporaryPath, "record.json"), JSON.stringify(record), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, path);
    return { claim: "claimed", path, record };
  } catch (error) {
    await removeReclaimGuard(temporaryPath);
    if (
      !(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "EEXIST" || error.code === "ENOTEMPTY")
      )
    ) {
      if (error instanceof StoreBusyError) throw error;
      throw new StoreBusyError(`cannot claim stale lock ${path}`, error);
    }
  }

  let guardText: string;
  try {
    guardText = await readFile(join(path, "record.json"), "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      // Atomically-published guards always contain the record. Its absence
      // means the directory was concurrently removed/replaced; retry.
      return { claim: "changed", path };
    }
    throw new StoreBusyError(`cannot read reclaim guard ${path}`, error);
  }
  const guard = parseReclaimGuard(guardText, path);
  if (!sameLockRecord(guard.target, expected)) {
    // A hash collision or a manually replaced guard is never evidence that
    // this caller may reclaim the lock.
    return { claim: "busy", path };
  }

  // A live claimant owns the guard. Even if its lock PID has been reused, the
  // conservative answer is to wait; deleting the guard could let two writers
  // reclaim the same stale lock. A dead claimant's guard is safe to retire,
  // but this call only retires it and lets the next acquisition attempt claim
  // afresh (it never deletes .lock in the same turn).
  if (
    await isRecordedProcessAlive({
      pid: guard.claimerPid,
      startedAt: guard.claimerStartedAt,
      processStartedAt: guard.claimerProcessStartedAt,
    })
  ) {
    return { claim: "busy", path, record: guard };
  }
  await removeReclaimGuard(path);
  return { claim: "changed", path, record: guard };
}

async function readCurrentLock(path: string): Promise<MutationLockRecord | "gone"> {
  try {
    return parseLockRecord(await readFile(path, "utf8"), path);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return "gone";
    }
    if (error instanceof StoreBusyError) throw error;
    throw new StoreBusyError(`cannot read lock file ${path}`, error);
  }
}

async function reclaimStaleLock(
  rootPath: string,
  expected: MutationLockRecord,
): Promise<ReclaimOutcome> {
  const path = lockPath(rootPath);
  const current = await readCurrentLock(path);
  if (current === "gone") return "gone";
  if (!sameLockRecord(current, expected)) return "changed";
  // `process.kill(pid, 0)` is intentionally conservative: a reused PID is
  // treated as live, so a stale lock may wait longer but can never be deleted
  // underneath the unrelated process. ownerToken prevents an old handle in
  // this process from releasing a newer lock.
  if (await isRecordedProcessAlive(current)) return "busy";

  const guard = await claimReclaimGuard(rootPath, expected);
  if (guard.claim !== "claimed") return guard.claim === "changed" ? "busy" : "busy";
  try {
    const confirmed = await readCurrentLock(path);
    if (confirmed === "gone") return "gone";
    if (!sameLockRecord(confirmed, expected) || (await isRecordedProcessAlive(confirmed))) {
      return "changed";
    }
    try {
      await unlink(path);
      return "removed";
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return "gone";
      }
      throw new StoreBusyError(`cannot reclaim stale lock ${path}`, error);
    }
  } finally {
    await removeReclaimGuard(guard.path);
  }
}

/**
 * Reclaim a lock whose holder process is gone (ADR 0007 §12). Cold open calls
 * this only after a consistent read. Mutation acquisition may reclaim first,
 * but lifecycle code must then run journal recovery before any new write.
 * Returns whether a stale lock was actually removed.
 */
export async function reclaimStaleMutationLock(rootPath: string): Promise<boolean> {
  const path = lockPath(rootPath);
  const record = await readCurrentLock(path);
  if (record === "gone") return false;
  return (await reclaimStaleLock(rootPath, record)) === "removed";
}

/** Read-only liveness check used to classify transient consistency mismatches. */
export async function isMutationLockHeld(rootPath: string): Promise<boolean> {
  const record = await readCurrentLock(lockPath(rootPath));
  return record === "gone" ? false : isRecordedProcessAlive(record);
}

type TryCreateLockResult =
  | MutationLockHandle
  | { held: MutationLockRecord }
  | { stale: MutationLockRecord }
  | "retry";

async function tryCreateLock(rootPath: string): Promise<TryCreateLockResult> {
  const path = lockPath(rootPath);
  const record: MutationLockRecord = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    processStartedAt: CURRENT_PROCESS_STARTED_AT,
    ownerToken: randomUUID(),
  };
  try {
    // "wx" creates the lock file atomically and fails with EEXIST when a lock
    // is held — create-or-fail, never clobber.
    await writeFile(path, JSON.stringify(record), { encoding: "utf8", flag: "wx" });
  } catch (error) {
    // "wx" fails with EEXIST when the lock is held; anything else is a real
    // storage problem surfaced as StoreBusyError (never a silent retry loop).
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
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
          return "retry";
        }
        throw new StoreBusyError(`cannot read lock file ${path}`, readError);
      }
      const held = parseLockRecord(text, path);
      return (await isRecordedProcessAlive(held)) ? { held } : { stale: held };
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
        if (sameLockRecord(currentRecord, record)) {
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
 * Mutations are exclusive; the normal read path never takes this lock. A lock
 * whose holder process is gone is atomically claimed and reclaimed; lifecycle
 * code must run operation-journal recovery after acquisition and before any
 * new write.
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
    if (attempt === "retry") continue;
    if (!("held" in attempt) && !("stale" in attempt)) return attempt;
    if ("stale" in attempt) {
      // Reclaim is guarded by an atomically-created per-record directory. A
      // competing reclaimer returns busy and this loop waits; it never
      // unlinks the path based on an earlier read.
      // eslint-disable-next-line no-await-in-loop -- stale reclaim is serialized
      const outcome = await reclaimStaleLock(rootPath, attempt.stale);
      if (outcome === "removed" || outcome === "gone") continue;
      if (Date.now() >= deadline) {
        throw new StoreBusyError(
          `mutation lock is held by pid ${attempt.stale.pid} (started ${attempt.stale.startedAt})`,
        );
      }
      // eslint-disable-next-line no-await-in-loop -- polling is inherently sequential
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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
