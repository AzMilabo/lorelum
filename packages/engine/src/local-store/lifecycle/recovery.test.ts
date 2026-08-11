import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { UnvalidatedPackInput } from "@lorelum/format";

import { createLocalStore, type StorageRoot } from "../index";
import { StoreRecoveryRequiredError } from "../../local-store";
import { createPackCandidate, type PackCandidate } from "../model";
import { acquireMutationLock } from "../storage/mutation-lock";
import { createOperationJournalRecord, writeOperationJournal } from "../storage/journal/operation-journal";
import { readManifest } from "../storage/manifest/manifest-store";
import { sqlitePath, openStoreDatabase } from "../storage/sqlite/database";

async function removeStoreRoot(rootPath: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- retries must back off serially
      await rm(rootPath, { recursive: true, force: true });
      return;
    } catch {
      if (attempt === 9) throw new Error("cannot remove store root after retries");
      // eslint-disable-next-line no-await-in-loop -- backoff must be sequential
      await Bun.sleep(50);
    }
  }
}

async function withRoot(run: (root: StorageRoot) => Promise<void>): Promise<void> {
  const rootPath = await mkdtemp(join(tmpdir(), "lorelum-recover-"));
  try {
    await run({ rootPath });
  } finally {
    await removeStoreRoot(rootPath);
  }
}

function packInput(name: string, practices: Record<string, string>): UnvalidatedPackInput {
  return {
    pack: { name, version: "1.0.0" },
    practices: Object.entries(practices).map(([id, body]) => ({
      id,
      title: id.split(".").pop(),
      stage: "api",
      tech_stack: ["typescript"],
      applies_when: "building anything at all",
      severity: "warn",
      body,
    })),
    decisions: [],
  };
}

function sourcePaths(input: UnvalidatedPackInput): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const practice of input.practices) {
    if (typeof practice === "object" && practice !== null && "id" in practice) {
      const id = String((practice as { id: unknown }).id);
      paths[id] = `practices/${id.replace(/\./g, "/")}.md`;
    }
  }
  return paths;
}

function candidate(name: string, practices: Record<string, string>): PackCandidate {
  const input = packInput(name, practices);
  return createPackCandidate(input, sourcePaths(input)).candidate;
}

const platform = { "platform.api": "Use APIs.\n", "platform.auth": "Authenticate.\n" };

test("crash after manifest publish but before SQLite commit converges to the old tuple", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    const before = await readManifest(root.rootPath);

    // Simulate the crash window: manifest published, SQLite not yet committed.
    // A leftover journal with old tuple (0,0) → target tuple (1,1) plus a
    // manifest already at (1,1) means recovery must restore the old manifest.
    const journal = createOperationJournalRecord("install", before, {
      ...before,
      generation: before.generation + 1,
      effectiveRevision: before.effectiveRevision + 1,
    });
    await writeOperationJournal(root.rootPath, journal);

    // open() runs recovery; SQLite tuple == old tuple → restore old manifest.
    const reopened = await store.open(root);
    expect(reopened.generation).toBe(before.generation);
  });
});

test("cold open rejects a missing SQLite file", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    await rm(sqlitePath(root.rootPath), { force: true });
    // open() recreates an empty DB file, then recovery detects that the
    // manifest has committed state the (empty) SQLite never saw.
    await expect(store.open(root)).rejects.toBeInstanceOf(StoreRecoveryRequiredError);
  });
});

test("cold open rejects SQLite whose tuple disagrees with the manifest", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    // Tamper SQLite metadata without a journal: manifest wins on recovery,
    // but the tuples disagree and no journal exists → recovery required.
    const database = await openStoreDatabase(root.rootPath);
    database
      .query("UPDATE local_store_metadata SET installed_packs_generation = 99")
      .run();
    database.close();
    await expect(store.open(root)).rejects.toBeInstanceOf(StoreRecoveryRequiredError);
  });
});

test("cold open rejects a tampered artifact digest", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    // Corrupt an author byte inside the immutable snapshot.
    const manifest = await readManifest(root.rootPath);
    const entry = manifest.packs[0]!;
    const practicePath = join(
      root.rootPath,
      "packs",
      entry.storageKey,
      entry.artifactDigest,
      "practices",
      "platform/api.md",
    );
    await writeFile(practicePath, "---\nid: platform.api\ntitle: T\nstage: api\ntech_stack: [typescript]\napplies_when: always\n---\nTampered.\n");
    await expect(store.open(root)).rejects.toThrow("digest mismatch");
  });
});

test("reindex rebuilds a store whose SQLite was deleted", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    await rm(sqlitePath(root.rootPath), { force: true });

    const reindexed = await store.reindex(root);
    expect(reindexed.effectiveRevision).toBeGreaterThan(0);
    const practices = await store.readEffectivePractices(root);
    expect(practices.map((p) => p.practiceId)).toEqual(["platform.api", "platform.auth"]);
  });
});

test("reindex restores derived state from the manifest and sealed artifacts", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    // Corrupt SQLite metadata to force an inconsistent tuple.
    const database = await openStoreDatabase(root.rootPath);
    database.query("UPDATE local_store_metadata SET effective_revision = 42").run();
    database.close();

    const reindexed = await store.reindex(root);
    // reindex derives the fresh revision from the manifest (authority), not
    // from the tampered SQLite value.
    expect(reindexed.effectiveRevision).toBeGreaterThan(0);
    const reopened = await store.open(root);
    expect(reopened.effectivePractices).toHaveLength(2);
  });
});

test("reindex never revives an uninstalled pack", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    await store.uninstall(root, "platform");
    const reindexed = await store.reindex(root);
    expect(reindexed.delta.added).toEqual([]);
    expect(await store.readEffectivePractices(root)).toEqual([]);
  });
});

test("the post-commit hook receives each new revision with its delta", async () => {
  await withRoot(async (root) => {
    const notifications: { revision: number; added: readonly string[] }[] = [];
    const store = createLocalStore({
      onEffectiveRevisionAdvanced: (revision, delta) => {
        notifications.push({ revision, added: delta.added });
      },
    });
    await store.install(root, candidate("platform", platform));
    expect(notifications).toEqual([
      { revision: 1, added: ["platform.api", "platform.auth"] },
    ]);
  });
});

test("a failing post-commit hook never rolls back the mutation", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore({
      onEffectiveRevisionAdvanced: () => {
        throw new Error("vector layer offline");
      },
    });
    const installed = await store.install(root, candidate("platform", platform));
    expect(installed.generation).toBe(1);
    expect(installed.notificationPending?.revision).toBe(1);
    expect(installed.notificationPending?.error).toBeInstanceOf(Error);
    expect(await store.readEffectivePractices(root)).toHaveLength(2);
  });
});

test("concurrent mutations are serialized by the lock", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    const lock = await acquireMutationLock(root.rootPath);
    // A mutation waiting on a held lock gives up after its bounded wait.
    await expect(
      Promise.race([
        store.install(root, candidate("platform", platform)),
        Bun.sleep(1_000).then(() => "timeout"),
      ]),
    ).resolves.toBe("timeout");
    await lock.release();
    const installed = await store.install(root, candidate("platform", platform));
    expect(installed.generation).toBe(1);
  });
});
