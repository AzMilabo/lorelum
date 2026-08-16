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
    expect(record.ownerToken).toMatch(/[0-9a-f-]{36}/);
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

test("a reused PID with a different process start is reclaimed", async () => {
  await withRoot(async (root) => {
    await writeFile(
      lockPath(root),
      JSON.stringify({
        pid: process.pid,
        startedAt: new Date(0).toISOString(),
        processStartedAt: new Date(0).toISOString(),
        ownerToken: "old-process-owner",
      }),
      "utf8",
    );
    const next = await acquireMutationLock(root, { waitMs: 100, pollIntervalMs: 5 });
    const record = parseLockRecord(await readFile(lockPath(root), "utf8"), lockPath(root));
    expect(record.ownerToken).not.toBe("old-process-owner");
    await next.release();
  });
});

test("concurrent stale reclaimers elect one remover and preserve the next holder", async () => {
  await withRoot(async (root) => {
    await writeFile(
      lockPath(root),
      JSON.stringify({
        pid: Number.MAX_SAFE_INTEGER,
        startedAt: new Date().toISOString(),
        ownerToken: "crashed-owner",
      }),
      "utf8",
    );

    // Separate Bun processes exercise the actual cross-process race. The
    // atomic per-record reclaim guard lets exactly one attempt remove the
    // stale path; the others must observe the guard/changed path and never
    // unlink a subsequently-created holder.
    const moduleUrl = new URL("./mutation-lock.ts", import.meta.url).href;
    const childScript = `
      const lock = await import(${JSON.stringify(moduleUrl)});
      const result = await lock.reclaimStaleMutationLock(process.argv[1]);
      process.stdout.write(JSON.stringify(result));
    `;
    const children = Array.from({ length: 4 }, () =>
      Bun.spawn([process.execPath, "-e", childScript, root], {
        stdout: "pipe",
        stderr: "pipe",
      }),
    );
    const outcomes = await Promise.all(
      children.map(async (child) => {
        const [exitCode, output] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
        ]);
        if (exitCode !== 0) {
          throw new Error(
            `stale reclaimer exited ${exitCode}: ${await new Response(child.stderr).text()}`,
          );
        }
        return JSON.parse(output.trim()) as boolean;
      }),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);

    const next = await acquireMutationLock(root);
    const record = parseLockRecord(await readFile(lockPath(root), "utf8"), lockPath(root));
    expect(record.pid).toBe(process.pid);
    expect(record.ownerToken).not.toBe("crashed-owner");
    await next.release();
  });
});
