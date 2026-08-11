import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  clearOperationJournal,
  createOperationJournalRecord,
  listOperationJournals,
  parseOperationJournalRecord,
  readOperationJournal,
  writeOperationJournal,
} from "./operation-journal";
import { createEmptyManifest, parseManifest, serializeManifest } from "../manifest/manifest-store";

async function withRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "lorelum-journal-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("journal round-trips full manifest preimage and target", async () => {
  await withRoot(async (root) => {
    const oldManifest = createEmptyManifest();
    const targetManifest = parseManifest(
      serializeManifest({
        ...createEmptyManifest(),
        generation: 1,
        effectiveRevision: 1,
        packs: [
          {
            packName: "platform",
            packVersion: "1.0.0",
            artifactDigest: "a".repeat(64),
            storageKey: "p-platform",
            installedAt: "2026-07-27T00:00:00.000Z",
          },
        ],
      }),
      "target",
    );
    const record = createOperationJournalRecord("install", oldManifest, targetManifest);
    expect(record.oldGeneration).toBe(0);
    expect(record.targetGeneration).toBe(1);

    await writeOperationJournal(root, record);
    expect(await listOperationJournals(root)).toEqual([record.operationId]);
    const readBack = await readOperationJournal(root, record.operationId);
    expect(readBack.operationType).toBe("install");
    expect(parseManifest(readBack.oldManifest, "old")).toEqual(oldManifest);
    expect(parseManifest(readBack.targetManifest, "target")).toEqual(targetManifest);

    await clearOperationJournal(root, record.operationId);
    expect(await listOperationJournals(root)).toEqual([]);
  });
});

test("journal rejects a record with a tampered manifest payload", () => {
  const record = createOperationJournalRecord(
    "uninstall",
    createEmptyManifest(),
    createEmptyManifest(),
  );
  const tampered = { ...record, targetManifest: '{"schemaVersion":999}' };
  expect(() => parseOperationJournalRecord(JSON.stringify(tampered), "journal")).toThrow(
    "manifest",
  );
});

test("journal rejects malformed tuples and operation ids", () => {
  const record = createOperationJournalRecord(
    "install",
    createEmptyManifest(),
    createEmptyManifest(),
  );
  for (const bad of [
    { ...record, oldGeneration: -1 },
    { ...record, targetEffectiveRevision: 1.5 },
    { ...record, operationId: "../escape" },
    { ...record, operationType: "garbage" },
  ]) {
    expect(() => parseOperationJournalRecord(JSON.stringify(bad), "journal")).toThrow(
      "unsupported shape",
    );
  }
});
