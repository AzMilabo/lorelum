import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { EffectivePractice } from "../model";
import { artifactPath, calculateArtifactDigest } from "../storage/artifacts/artifact-store";
import {
  parseProjection,
  PROJECTION_RELATIVE_PATH,
  type SnapshotProjection,
} from "../storage/artifacts/projection";
import { StoreBusyError, StoreRecoveryRequiredError } from "../storage/errors";
import {
  serializeManifest,
  tryReadManifest,
  type InstalledPacksManifest,
} from "../storage/manifest/manifest-store";
import { openStoreDatabase } from "../storage/sqlite/database";
import {
  readActivePackEntries,
  readEffectivePracticeSnapshot,
  readStoreMetadata,
} from "../storage/sqlite/snapshot-reader";

import { runStoreRecovery } from "./recovery";

export interface OpenResult {
  manifest: InstalledPacksManifest;
  effectivePractices: readonly EffectivePractice[];
}

function activeEntriesEqual(
  left: readonly InstalledPacksManifest["packs"][number][],
  right: readonly InstalledPacksManifest["packs"][number][],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    const l = left[index];
    const r = right[index];
    if (
      l === undefined ||
      r === undefined ||
      l.packName !== r.packName ||
      l.packVersion !== r.packVersion ||
      l.artifactDigest !== r.artifactDigest ||
      l.storageKey !== r.storageKey ||
      l.installedAt !== r.installedAt
    ) {
      return false;
    }
  }
  return true;
}

async function readSealedProjection(artifactDir: string): Promise<SnapshotProjection> {
  let text: string;
  try {
    text = await readFile(join(artifactDir, PROJECTION_RELATIVE_PATH), "utf8");
  } catch {
    throw new StoreRecoveryRequiredError(`cannot read sealed projection for ${artifactDir}`);
  }
  return parseProjection(text, artifactDir);
}

/**
 * Cold open (ADR 0007 §8): run schema migration, parse the active manifest,
 * check SQLite readability/integrity, check each active artifact exists with a
 * matching digest, read the digest-protected projection, and reconcile
 * SQLite's Active Pack / Practice source / Effective Practice against it.
 * Cold open does not scan all packs, re-parse Practice files, or regenerate
 * embeddings. Any inconsistency → `StoreRecoveryRequiredError`.
 */
export async function openLocalStore(rootPath: string): Promise<OpenResult> {
  const database = await openStoreDatabase(rootPath);
  try {
    const { manifest } = await runStoreRecovery(rootPath, database);
    const metadata = readStoreMetadata(database);
    if (metadata === undefined) {
      // Fresh store: manifest is empty and SQLite was never written.
      return { manifest, effectivePractices: Object.freeze([]) };
    }
    const snapshot = readEffectivePracticeSnapshot(database);

    // Active Pack rows must exactly mirror the manifest entries.
    const activePacks = readActivePackEntries(database);
    if (!activeEntriesEqual(activePacks, manifest.packs)) {
      throw new StoreRecoveryRequiredError("SQLite Active Pack rows differ from the active manifest");
    }

    // Each active artifact must exist with a matching digest and a valid,
    // digest-protected projection; sources and digests must reconcile.
    // Artifact checks are independent per pack — verify them in parallel.
    const expectedSources = new Map<string, { digest: string }>();
    await Promise.all(
      manifest.packs.map(async (entry) => {
        const artifactDir = artifactPath(rootPath, entry.storageKey, entry.artifactDigest);
        const digest = await calculateArtifactDigest(artifactDir);
        if (digest !== entry.artifactDigest) {
          throw new StoreRecoveryRequiredError(`artifact digest mismatch for ${entry.storageKey}`);
        }
        const projection = await readSealedProjection(artifactDir);
        if (
          projection.pack.name !== entry.packName ||
          projection.pack.version !== entry.packVersion
        ) {
          throw new StoreRecoveryRequiredError(
            `projection metadata differs from the manifest for ${entry.storageKey}`,
          );
        }
        for (const practice of projection.practices) {
          expectedSources.set(practice.sourcePath, { digest: practice.contentDigest });
        }
      }),
    );

    // Practice sources and Effective Practice rows must match the projections.
    for (const practice of snapshot.effectivePractices) {
      for (const source of practice.sources) {
        const expected = expectedSources.get(source.sourcePath);
        if (expected === undefined || expected.digest !== source.contentDigest) {
          throw new StoreRecoveryRequiredError(
            `source ${source.sourcePath} does not reconcile with any sealed projection`,
          );
        }
        expectedSources.delete(source.sourcePath);
      }
    }
    if (expectedSources.size > 0) {
      throw new StoreRecoveryRequiredError("sealed projections contain sources absent from SQLite");
    }

    return { manifest, effectivePractices: snapshot.effectivePractices };
  } finally {
    database.close();
  }
}

/**
 * Lock-free read consistency protocol (ADR 0007 §8): read + validate manifest
 * A, materialize SQLite in one transaction, validate the metadata tuple
 * against A, then read + validate manifest B. Return only when A and B have
 * identical canonical manifest bytes and the SQLite tuple equals their
 * `(generation, effectiveRevision)`; otherwise retry a bounded number of times
 * and then return `StoreBusyError`. A mismatch that is stable after retries is
 * `StoreRecoveryRequiredError`.
 */
export async function readEffectivePractices(rootPath: string): Promise<readonly EffectivePractice[]> {
  const MAX_READ_RETRIES = 3;
  const database = await openStoreDatabase(rootPath);
  try {
    for (let attempt = 0; attempt < MAX_READ_RETRIES; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- bounded retry is inherently sequential
      const manifestA = await tryReadManifest(rootPath);
      if (manifestA === undefined) {
        // No manifest at all: a fresh store has nothing to read. If SQLite
        // disagrees (has committed state), the recovery path owns it.
        const metadata = readStoreMetadata(database);
        if (metadata === undefined) return Object.freeze([]);
        throw new StoreRecoveryRequiredError(
          "SQLite has committed state but the active manifest is missing",
        );
      }
      const metadata = readStoreMetadata(database);
      if (metadata === undefined) {
        if (manifestA.generation === 0 && manifestA.effectiveRevision === 0) {
          return Object.freeze([]);
        }
        continue;
      }
      const snapshot = readEffectivePracticeSnapshot(database);
      const tupleMatches =
        metadata.generation === manifestA.generation &&
        metadata.effectiveRevision === manifestA.effectiveRevision;
      // eslint-disable-next-line no-await-in-loop -- manifest B must be read after the SQLite snapshot
      const manifestB = await tryReadManifest(rootPath);
      if (
        tupleMatches &&
        manifestB !== undefined &&
        serializeManifest(manifestA) === serializeManifest(manifestB)
      ) {
        return snapshot.effectivePractices;
      }
    }
    // Retries exhausted. Distinguish a stable mismatch (recovery required)
    // from transient concurrent writes (busy) by comparing two more reads.
    const manifestA = await tryReadManifest(rootPath);
    const manifestB = await tryReadManifest(rootPath);
    if (manifestA === undefined || manifestB === undefined || serializeManifest(manifestA) === serializeManifest(manifestB)) {
      throw new StoreRecoveryRequiredError(
        "manifest and SQLite tuples disagree after repeated reads",
      );
    }
    throw new StoreBusyError("LocalStore manifest kept changing during reads");
  } finally {
    database.close();
  }
}
