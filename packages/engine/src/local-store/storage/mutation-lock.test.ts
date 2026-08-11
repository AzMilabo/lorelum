import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { StoreBusyError } from "./errors";
import { acquireMutationLock, lockPath, parseLockRecord } from "./mutation-lock";

async function withRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "lorelum-lock-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("mutation lock round-trips and releases", async () => {
  await withRoot(async (root) => {
    const handle = await acquireMutationLock(root);
    const record = parseLockRecord(await readFile(lockPath(root), "utf8"), lockPath(root));
    expect(record.pid).toBe(process.pid);
    await handle.release();
    await expect(readFile(lockPath(root), "utf8")).rejects.toThrow();
  });
});

test("mutation lock is exclusive across handles", async () => {
  await withRoot(async (root) => {
    const first = await acquireMutationLock(root);
    await expect(
      acquireMutationLock(root, { waitMs: 150, pollIntervalMs: 20 }),
    ).rejects.toBeInstanceOf(StoreBusyError);
    await first.release();
    const second = await acquireMutationLock(root);
    await second.release();
  });
});

test("mutation lock reclaims a stale lock whose holder is gone", async () => {
  await withRoot(async (root) => {
    // A PID that cannot be alive: pid 1 is the init process on POSIX, but on
    // Windows there is no pid 1; use an implausibly large safe integer so
    // `process.kill` reliably reports the process as gone.
    await writeFile(
      lockPath(root),
      JSON.stringify({ pid: Number.MAX_SAFE_INTEGER, startedAt: new Date().toISOString() }),
      "utf8",
    );
    const handle = await acquireMutationLock(root);
    const record = parseLockRecord(await readFile(lockPath(root), "utf8"), lockPath(root));
    expect(record.pid).toBe(process.pid);
    await handle.release();
  });
});

test("mutation lock release never clobbers a newer holder", async () => {
  await withRoot(async (root) => {
    const first = await acquireMutationLock(root);
    // Simulate a stale reclaim by another process: replace the file.
    await writeFile(
      lockPath(root),
      JSON.stringify({ pid: 424242, startedAt: new Date().toISOString() }),
      "utf8",
    );
    await first.release();
    const record = parseLockRecord(await readFile(lockPath(root), "utf8"), lockPath(root));
    expect(record.pid).toBe(424242);
  });
});
