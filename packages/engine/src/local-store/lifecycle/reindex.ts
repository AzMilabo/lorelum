import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  diffEffectivePractices,
  reconcileEffectivePractices,
  type EffectivePractice,
  type PracticeSource,
} from "../model";
import { artifactPath, calculateArtifactDigest } from "../storage/artifacts/artifact-store";
import { decodeSnapshot } from "../storage/artifacts/snapshot-codec";
import {
  parseProjection,
  PROJECTION_RELATIVE_PATH,
  type SnapshotProjection,
} from "../storage/artifacts/projection";
import { ArtifactIntegrityError, ManifestError } from "../storage/errors";
import {
  clearOperationJournal,
  createOperationJournalRecord,
  writeOperationJournal,
} from "../storage/journal/operation-journal";
import {
  readManifest,
  writeManifest,
  type InstalledPackManifestEntry,
  type InstalledPacksManifest,
} from "../storage/manifest/manifest-store";
import { acquireMutationLock } from "../storage/mutation-lock";
import { openStoreDatabase, sqlitePath } from "../storage/sqlite/database";
import { readEffectivePracticeSnapshot } from "../storage/sqlite/snapshot-reader";
import { writeDerivedState } from "../storage/sqlite/state-writer";

import { notifyRevision } from "./mutation";
import type { EffectiveRevisionHook, ReindexResult } from "./types";

function entryPath(rootPath: string, entry: InstalledPackManifestEntry): string {
  return artifactPath(rootPath, entry.storageKey, entry.artifactDigest);
}

async function readSealedProjection(artifactDir: string): Promise<SnapshotProjection> {
  let text: string;
  try {
    text = await readFile(join(artifactDir, PROJECTION_RELATIVE_PATH), "utf8");
  } catch (error) {
    throw new ArtifactIntegrityError(
      artifactDir,
      "sealed projection cannot be read: " + (error instanceof Error ? error.message : String(error)),
    );
  }
  return parseProjection(text, artifactDir);
}

/**
 * The sealed projection and the re-decoded candidate must describe the same
 * Pack — otherwise the snapshot was tampered or the codec drifted, and
 * reindex must not overwrite derived state with it.
 */
function verifyProjectionMatches(
  entry: InstalledPackManifestEntry,
  sources: readonly PracticeSource[],
  decisions: readonly import("@lorelum/format").DecisionNode[],
  projection: SnapshotProjection,
): void {
  if (projection.pack.name !== entry.packName || projection.pack.version !== entry.packVersion) {
    throw new ManifestError(entry.storageKey, "projection pack metadata differs from the manifest");
  }
  const bySourcePath = new Map(
    sources.map((source) => [source.sourcePath, source] as const),
  );
  if (projection.practices.length !== sources.length) {
    throw new ManifestError(entry.storageKey, "projection practice count differs from re-parsed snapshot");
  }
  for (const expected of projection.practices) {
    const source = bySourcePath.get(expected.sourcePath);
    if (
      source === undefined ||
      source.practiceId !== expected.id ||
      source.contentDigest !== expected.contentDigest ||
      source.canonicalPractice.canonicalContent !== expected.canonicalContent
    ) {
      throw new ManifestError(
        entry.storageKey,
        `projection practice ${expected.id} differs from re-parsed snapshot`,
      );
    }
  }
  if (JSON.stringify(projection.decisions) !== JSON.stringify(decisions)) {
    throw new ManifestError(entry.storageKey, "projection decisions differ from re-parsed snapshot");
  }
}

/**
 * Merge every pack's sources from scratch. Packs are grouped by name and
 * reconciled one candidate at a time (candidate.pack.name must equal each
 * source's packName, which the merge rules assert); a cross-pack conflict
 * surfaces as `PracticeConflictError` and aborts the reindex. Decisions are
 * not part of the merge (they are per-pack, sealed in the projection).
 */
function mergeSources(sources: readonly PracticeSource[]): readonly EffectivePractice[] {
  const byPack = new Map<string, PracticeSource[]>();
  for (const source of sources) {
    const group = byPack.get(source.packName);
    if (group === undefined) byPack.set(source.packName, [source]);
    else group.push(source);
  }
  let reconciled = { sources: Object.freeze([] as readonly PracticeSource[]), effectivePractices: Object.freeze([] as readonly EffectivePractice[]) };
  for (const [packName, packSources] of byPack) {
    const candidate = {
      pack: Object.freeze({ name: packName, version: "0.0.0" }),
      sources: Object.freeze(packSources),
      decisions: Object.freeze([]),
    };
    reconciled = reconcileEffectivePractices(reconciled.sources, candidate);
  }
  return reconciled.effectivePractices;
}

function withFreshRevision(manifest: InstalledPacksManifest): InstalledPacksManifest {
  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    generation: manifest.generation + 1,
    effectiveRevision: manifest.effectiveRevision + 1,
    packs: manifest.packs,
  });
}

/**
 * Re-derive the whole store from the active manifest's snapshots (ADR 0007
 * §8). `reindex` is the recovery entry point and bypasses cold open: it
 * succeeds precisely where `open()` fails. It takes the active manifest's
 * Pack snapshots as its only input, re-runs format validation and derived-data
 * construction, generates a fresh `effectiveRevision`, and never scans or
 * revives historical artifacts.
 */
export async function reindexStore(
  rootPath: string,
  hook: EffectiveRevisionHook | undefined,
): Promise<ReindexResult> {
  const lock = await acquireMutationLock(rootPath);
  try {
    const manifest = await readManifest(rootPath);

    // Re-decode every active snapshot and verify the re-parsed result matches
    // the sealed projection before touching any derived state. Decoding is
    // independent per pack — run it in parallel, then flatten in manifest order.
    const decodedByIndex = await Promise.all(
      manifest.packs.map(async (entry) => {
        const artifactDir = entryPath(rootPath, entry);
        if ((await calculateArtifactDigest(artifactDir)) !== entry.artifactDigest) {
          throw new ManifestError(artifactDir, "artifact digest does not match the active manifest");
        }
        const decoded = await decodeSnapshot(artifactDir);
        const projection = await readSealedProjection(artifactDir);
        verifyProjectionMatches(
          entry,
          decoded.candidate.sources,
          decoded.candidate.decisions,
          projection,
        );
        return decoded.candidate.sources;
      }),
    );
    const sources: PracticeSource[] = decodedByIndex.flat();

    // Reconcile every pack together from scratch — no existing state is
    // trusted, and no uninstalled pack is revived.
    const effectivePractices = mergeSources(sources);

    // Open SQLite, replacing it when missing or corrupt; merely inconsistent
    // derived state is overwritten below.
    let database;
    try {
      database = await openStoreDatabase(rootPath);
    } catch {
      // Corrupt or missing SQLite is rebuilt from scratch (ADR 0007 §8):
      // drop the file and let the migration re-run on a fresh database.
      await rm(sqlitePath(rootPath), { force: true });
      database = await openStoreDatabase(rootPath);
    }
    try {
      // Previous effective state is only advisory (delta input); the manifest
      // is the authority and the derived tables are rebuilt wholesale.
      let previous: readonly EffectivePractice[] = [];
      try {
        previous = readEffectivePracticeSnapshot(database).effectivePractices;
      } catch {
        previous = [];
      }
      const delta = diffEffectivePractices(previous, effectivePractices);
      const targetManifest = withFreshRevision(manifest);
      const journal = createOperationJournalRecord("reindex", manifest, targetManifest);
      await writeOperationJournal(rootPath, journal);
      await writeManifest(rootPath, targetManifest);
      writeDerivedState(database, {
        generation: targetManifest.generation,
        effectiveRevision: targetManifest.effectiveRevision,
        activePacks: targetManifest.packs,
        effectivePractices,
      });
      await clearOperationJournal(rootPath, journal.operationId);
      const notificationPending = await notifyRevision(
        hook,
        targetManifest.effectiveRevision,
        delta,
      );
      return Object.freeze({
        generation: targetManifest.generation,
        effectiveRevision: targetManifest.effectiveRevision,
        delta,
        diagnostics: Object.freeze([]),
        cleanupPending: false,
        notificationPending,
      });
    } finally {
      database.close();
    }
  } finally {
    await lock.release();
  }
}
