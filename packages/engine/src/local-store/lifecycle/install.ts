import { rm } from "node:fs/promises";
import { join } from "node:path";

import type { ValidationIssue } from "@lorelum/format";

import {
  reconcileEffectivePractices,
  type EffectivePractice,
  type PackCandidate,
  type PracticeSource,
} from "../model";
import {
  artifactPath,
  promoteArtifact,
  sealSnapshot,
} from "../storage/artifacts/artifact-store";
import {
  createProjection,
  type SnapshotProjection,
} from "../storage/artifacts/projection";
import { writeSnapshotFromCandidate } from "../storage/artifacts/snapshot-writer";
import {
  clearOperationJournal,
  createOperationJournalRecord,
  writeOperationJournal,
} from "../storage/journal/operation-journal";
import {
  writeManifest,
  type InstalledPackManifestEntry,
  type InstalledPacksManifest,
} from "../storage/manifest/manifest-store";
import {
  readEffectivePracticeSnapshot,
  readStoreMetadata,
} from "../storage/sqlite/snapshot-reader";
import { writeDerivedState } from "../storage/sqlite/state-writer";

import { UpgradeRequiredError } from "./errors";
import { notifyRevision, withStoreMutation, type MutationLockOptions } from "./mutation";
import type { EffectiveRevisionHook, InstallResult } from "./types";

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function entryForCandidate(candidate: PackCandidate, artifactDigest: string): InstalledPackManifestEntry {
  return Object.freeze({
    packName: candidate.pack.name,
    packVersion: candidate.pack.version,
    artifactDigest,
    storageKey: "p-" + candidate.pack.name,
    installedAt: new Date().toISOString(),
  });
}

function withPackEntry(
  manifest: InstalledPacksManifest,
  entry: InstalledPackManifestEntry,
  replace: boolean,
  effectiveRevision: number,
): InstalledPacksManifest {
  const packs = replace
    ? manifest.packs.map((pack) => (pack.packName === entry.packName ? entry : pack))
    : [...manifest.packs, entry];
  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    generation: manifest.generation + 1,
    effectiveRevision,
    packs: Object.freeze([...packs].sort((l, r) => compareCodeUnits(l.packName, r.packName))),
  });
}

/** Materialize the active source set from the materialized snapshot. */
function activeSources(effectivePractices: readonly EffectivePractice[]): readonly PracticeSource[] {
  return effectivePractices.flatMap((practice) => practice.sources);
}

/**
 * Install or upgrade one pack (ADR 0007 §7, 定稿 §5). The two flows share
 * this orchestration: only the conflict-check replacement set and the journal
 * operation type differ.
 *
 * Sequencing (all cross-medium commits happen here, never in storage/):
 * 1. stage a rebuilt snapshot + projection, seal it → artifactDigest
 * 2. idempotency check (same digest already active → no-op success)
 * 3. conflict check via the pure merge rules (install: add; upgrade: replace)
 * 4. promote the artifact, write the operation journal
 * 5. publish the target manifest, commit SQLite derived state
 * 6. clear the journal, fire the post-commit hook, collect garbage
 */
export async function installOrUpgrade(
  rootPath: string,
  candidate: PackCandidate,
  mode: "install" | "upgrade",
  hook: EffectiveRevisionHook | undefined,
  diagnostics: readonly ValidationIssue[] = [],
  lockOptions: MutationLockOptions = {},
): Promise<InstallResult> {
  return withStoreMutation(
    rootPath,
    async ({ database, recovery }) => {
    // `recovery.manifest` is the converged, tuple-validated manifest (fresh
    // store → empty manifest), so install never re-reads or re-guesses it.
    const active = recovery.manifest;
    const metadata = readStoreMetadata(database);
    const effectivePractices =
      metadata === undefined
        ? []
        : readEffectivePracticeSnapshot(database).effectivePractices;
    const existingEntry = active.packs.find((pack) => pack.packName === candidate.pack.name);

    // Stage the immutable snapshot and compute its artifact digest before any
    // manifest or SQLite state changes. The staging dir is cleaned up on
    // every non-success path.
    const stagingPath = join(rootPath, "staging", crypto.randomUUID());
    let artifactDigest: string;
    try {
      await writeSnapshotFromCandidate(stagingPath, candidate);
      const projection: SnapshotProjection = createProjection(candidate.pack, candidate.sources);
      artifactDigest = await sealSnapshot(stagingPath, projection);
    } catch (error) {
      await rm(stagingPath, { recursive: true, force: true });
      throw error;
    }

    // Same digest already active → idempotent success, no state change.
    if (existingEntry !== undefined && existingEntry.artifactDigest === artifactDigest) {
      await rm(stagingPath, { recursive: true, force: true });
      return Object.freeze({
        generation: recovery.manifest.generation,
        effectiveRevision: recovery.manifest.effectiveRevision,
        delta: Object.freeze({ added: Object.freeze([]), changed: Object.freeze([]), invalidated: Object.freeze([]) }),
        diagnostics,
        cleanupPending: false,
        idempotent: true,
      });
    }
    // install is only for not-yet-active packs; a different digest requires
    // the explicit upgrade flow (ADR 0007 §7).
    if (mode === "install" && existingEntry !== undefined) {
      await rm(stagingPath, { recursive: true, force: true });
      throw new UpgradeRequiredError(
        candidate.pack.name,
        existingEntry.artifactDigest,
        artifactDigest,
      );
    }

    const reconciled = reconcileEffectivePractices(
      activeSources(effectivePractices),
      candidate,
      mode === "upgrade" ? candidate.pack.name : undefined,
    );
    const entry = entryForCandidate(candidate, artifactDigest);
    const advances = reconciled.advancesEffectiveRevision;
    const targetManifest = withPackEntry(
      active,
      entry,
      mode === "upgrade",
      advances ? active.effectiveRevision + 1 : active.effectiveRevision,
    );

    // Persist the journal before publishing the target manifest so recovery
    // can compare the (generation, effectiveRevision) tuple (ADR 0007 §8).
    const journal = createOperationJournalRecord(mode, active, targetManifest);
    await writeOperationJournal(rootPath, journal);

    try {
      await promoteArtifact(rootPath, entry.storageKey, artifactDigest, stagingPath);
      await writeManifest(rootPath, targetManifest);
      writeDerivedState(database, {
        generation: targetManifest.generation,
        effectiveRevision: targetManifest.effectiveRevision,
        activePacks: targetManifest.packs,
        effectivePractices: reconciled.effectivePractices,
      });
    } catch (error) {
      await rm(stagingPath, { recursive: true, force: true });
      throw error;
    }

    // The mutation has committed: the journal can be cleared, then the
    // post-commit hook fires. A hook failure never rolls back the commit —
    // it is surfaced as a pending notification (ADR 0007 §4).
    await clearOperationJournal(rootPath, journal.operationId);
    const notificationPending = advances
      ? await notifyRevision(hook, targetManifest.effectiveRevision, reconciled.delta)
      : undefined;

    // Post-commit GC: an upgrade leaves the previous digest's artifact
    // unreferenced. Cleanup failure is retryable and never turns the
    // committed mutation into a reported failure (ADR 0007 §3.3).
    let cleanupPending = false;
    if (mode === "upgrade" && existingEntry !== undefined) {
      try {
        await rm(
          artifactPath(rootPath, entry.storageKey, existingEntry.artifactDigest),
          { recursive: true, force: true },
        );
      } catch {
        cleanupPending = true;
      }
    }

    return Object.freeze({
      generation: targetManifest.generation,
      effectiveRevision: targetManifest.effectiveRevision,
      delta: reconciled.delta,
      diagnostics,
      cleanupPending,
      idempotent: false,
      notificationPending,
    });
    },
    lockOptions,
  );
}
