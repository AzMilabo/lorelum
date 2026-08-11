import { rm } from "node:fs/promises";

import { removePackSources } from "../model";
import { artifactPath } from "../storage/artifacts/artifact-store";
import {
  clearOperationJournal,
  createOperationJournalRecord,
  writeOperationJournal,
} from "../storage/journal/operation-journal";
import { writeManifest, type InstalledPacksManifest } from "../storage/manifest/manifest-store";
import {
  readEffectivePracticeSnapshot,
  readStoreMetadata,
} from "../storage/sqlite/snapshot-reader";
import { writeDerivedState } from "../storage/sqlite/state-writer";

import { PackNotInstalledError } from "./errors";
import { activeSources, notifyRevision, withStoreMutation } from "./mutation";
import type { EffectiveRevisionHook, UninstallResult } from "./types";

function withoutPack(
  manifest: InstalledPacksManifest,
  packName: string,
  effectiveRevision: number,
): InstalledPacksManifest {
  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    generation: manifest.generation + 1,
    effectiveRevision,
    packs: Object.freeze(manifest.packs.filter((pack) => pack.packName !== packName)),
  });
}

/**
 * Uninstall one pack (ADR 0007 §7, 定稿 §6). The pack's sources are removed;
 * an Effective Practice survives while another pack still provides it, and is
 * deleted when its last source goes away. Deleting a pack that is not active
 * throws `PackNotInstalledError` — never silent success.
 */
export async function uninstallPack(
  rootPath: string,
  packName: string,
  hook: EffectiveRevisionHook | undefined,
): Promise<UninstallResult> {
  return withStoreMutation(rootPath, async ({ database, recovery }) => {
    const active = recovery.manifest;
    const entry = active.packs.find((pack) => pack.packName === packName);
    if (entry === undefined) throw new PackNotInstalledError(packName);

    const metadata = readStoreMetadata(database);
    const effectivePractices =
      metadata === undefined
        ? []
        : readEffectivePracticeSnapshot(database).effectivePractices;
    const reconciled = removePackSources(activeSources(effectivePractices), packName);

    const advances = reconciled.advancesEffectiveRevision;
    const targetManifest = withoutPack(
      active,
      packName,
      advances ? active.effectiveRevision + 1 : active.effectiveRevision,
    );

    const journal = createOperationJournalRecord("uninstall", active, targetManifest);
    await writeOperationJournal(rootPath, journal);
    await writeManifest(rootPath, targetManifest);
    writeDerivedState(database, {
      generation: targetManifest.generation,
      effectiveRevision: targetManifest.effectiveRevision,
      activePacks: targetManifest.packs,
      effectivePractices: reconciled.effectivePractices,
    });

    await clearOperationJournal(rootPath, journal.operationId);
    const notificationPending = advances
      ? await notifyRevision(hook, targetManifest.effectiveRevision, reconciled.delta)
      : undefined;

    // Post-commit GC: the removed pack's artifact is no longer referenced.
    let cleanupPending = false;
    try {
      await rm(artifactPath(rootPath, entry.storageKey, entry.artifactDigest), {
        recursive: true,
        force: true,
      });
    } catch {
      cleanupPending = true;
    }

    return Object.freeze({
      generation: targetManifest.generation,
      effectiveRevision: targetManifest.effectiveRevision,
      delta: reconciled.delta,
      diagnostics: Object.freeze([]),
      cleanupPending,
      notificationPending,
    });
  });
}
