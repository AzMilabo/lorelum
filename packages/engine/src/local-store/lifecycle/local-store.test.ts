import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { UnvalidatedPackInput } from "@lorelum/format";

import { createLocalStore, defaultStorageRoot, type StorageRoot } from "../index";
import { createPackCandidate, type PackCandidate } from "../model";

/**
 * bun:sqlite releases its Windows file handle asynchronously after close(),
 * so a directory containing store.sqlite may briefly report EBUSY. Retry the
 * cleanup — the production code never deletes a store root it just closed.
 */
async function removeStoreRoot(rootPath: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- retries must back off serially
      await rm(rootPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      // eslint-disable-next-line no-await-in-loop -- backoff must be sequential
      await Bun.sleep(50);
    }
  }
}

async function withRoot(run: (root: StorageRoot) => Promise<void>): Promise<void> {
  const rootPath = await mkdtemp(join(tmpdir(), "lorelum-store-"));
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
const platformV2 = { "platform.api": "Use APIs with retries.\n" };
const web = { "platform.api": "Use APIs.\n", "web.css": "Use CSS.\n" };

test("default storage root resolves under the home directory", () => {
  const root = defaultStorageRoot();
  expect(root.rootPath).toEndWith(".lorelum");
});

test("fresh store open + install + reopen round-trips state", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    const opened = await store.open(root);
    expect(opened.generation).toBe(0);
    expect(opened.effectivePractices).toEqual([]);

    const installed = await store.install(root, candidate("platform", platform));
    expect(installed.generation).toBe(1);
    expect(installed.effectiveRevision).toBe(1);
    expect(installed.delta.added).toEqual(["platform.api", "platform.auth"]);
    expect(installed.cleanupPending).toBe(false);

    const reopened = await store.open(root);
    expect(reopened.generation).toBe(1);
    expect(reopened.effectivePractices.map((p) => p.practiceId)).toEqual([
      "platform.api",
      "platform.auth",
    ]);
    expect(await store.readEffectivePractices(root)).toHaveLength(2);
  });
});

test("install is idempotent for the same artifact digest", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    const again = await store.install(root, candidate("platform", platform));
    expect(again.idempotent).toBe(true);
    expect(again.generation).toBe(1); // no state change
    expect(again.effectiveRevision).toBe(1);
  });
});

test("install with a different digest requires upgrade", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    await expect(
      store.install(root, candidate("platform", platformV2)),
    ).rejects.toThrow("use upgrade");
  });
});

test("upgrade replaces sources and removes old ones", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    const first = await store.install(root, candidate("platform", platform));
    // platformV2 drops platform.auth and changes platform.api.
    const upgraded = await store.upgrade(root, candidate("platform", platformV2));
    expect(upgraded.delta.changed).toEqual(["platform.api"]);
    expect(upgraded.delta.invalidated).toEqual(["platform.auth"]);
    expect(upgraded.generation).toBe(first.generation + 1);
    expect(upgraded.effectiveRevision).toBe(first.effectiveRevision + 1);

    const practices = await store.readEffectivePractices(root);
    expect(practices.map((p) => p.practiceId)).toEqual(["platform.api"]);
    expect(practices[0]?.practice.body).toBe("Use APIs with retries.\n");
  });
});

test("upgrade conflicting with another active pack's practice is rejected", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    // web provides platform.api with identical content → mergeable.
    await store.install(root, candidate("web", web));
    // platformV2 changes platform.api; web still provides the old content.
    await expect(
      store.upgrade(root, candidate("platform", platformV2)),
    ).rejects.toThrow("conflicts with active pack");
  });
});

test("same practice id + different digest is rejected on install", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    const conflicting = candidate("other", { "platform.api": "Different content.\n" });
    await expect(store.install(root, conflicting)).rejects.toThrow("conflicts with active pack");
  });
});

test("a source-only addition does not advance effectiveRevision (定稿 §9 #6)", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    const first = await store.install(root, candidate("platform", platform));
    // web re-provides platform.api with byte-identical content and nothing
    // else: only the source set changes, the Effective Practice set does not.
    const merged = await store.install(
      root,
      candidate("web", { "platform.api": "Use APIs.\n" }),
    );
    expect(merged.delta).toEqual({
      added: [],
      changed: [],
      invalidated: [],
    });
    expect(merged.effectiveRevision).toBe(first.effectiveRevision);
    expect(merged.generation).toBe(first.generation + 1); // manifest still changes

    const practices = await store.readEffectivePractices(root);
    const api = practices.find((p) => p.practiceId === "platform.api");
    expect(api?.sources.map((s) => s.packName).sort()).toEqual(["platform", "web"]);
  });
});

test("uninstall keeps a practice still provided by another pack", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    await store.install(root, candidate("web", web));
    const removed = await store.uninstall(root, "platform");
    expect(removed.delta.invalidated).toEqual(["platform.auth"]);
    expect(removed.delta.added).toEqual([]);

    const practices = await store.readEffectivePractices(root);
    expect(practices.map((p) => p.practiceId)).toEqual(["platform.api", "web.css"]);
    expect(practices[0]?.sources.map((s) => s.packName)).toEqual(["web"]);
  });
});

test("uninstall of the last source deletes the Effective Practice", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    const removed = await store.uninstall(root, "platform");
    expect(removed.delta.invalidated).toEqual(["platform.api", "platform.auth"]);
    expect(await store.readEffectivePractices(root)).toEqual([]);
  });
});

test("uninstall of a missing pack throws PackNotInstalledError", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    await store.install(root, candidate("platform", platform));
    await expect(store.uninstall(root, "missing")).rejects.toThrow("not installed");
  });
});

test("format validation failure leaves no state behind", async () => {
  await withRoot(async (root) => {
    const store = createLocalStore();
    const input = packInput("bad", { "bad.id": "x" });
    (input.practices[0] as { id: string }).id = "no-dots";
    await expect(
      Promise.resolve().then(() => createPackCandidate(input, sourcePaths(input))),
    ).rejects.toThrow("format validation");
    const opened = await store.open(root);
    expect(opened.effectivePractices).toEqual([]);
  });
});
