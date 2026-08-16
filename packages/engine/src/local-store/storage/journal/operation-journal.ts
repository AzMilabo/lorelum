import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ManifestError } from "../errors";
import {
  parseManifest,
  serializeManifest,
  type InstalledPacksManifest,
} from "../manifest/manifest-store";

export const OPERATIONS_DIRECTORY_NAME = "operations";

export type OperationType = "install" | "upgrade" | "uninstall" | "reindex";

/**
 * One manifest-mutating operation's recovery record (ADR 0007 §8). The two
 * manifests are complete, schema-validated payloads (serialized), never
 * deltas — rollback never reconstructs a Pack list from tuple values.
 */
export interface OperationJournalRecord {
  operationId: string;
  operationType: OperationType;
  oldGeneration: number;
  targetGeneration: number;
  oldEffectiveRevision: number;
  targetEffectiveRevision: number;
  oldManifest: string;
  targetManifest: string;
  createdAt: string;
}

export function operationsDirectory(rootPath: string): string {
  return join(rootPath, OPERATIONS_DIRECTORY_NAME);
}

export function operationJournalPath(rootPath: string, operationId: string): string {
  return join(operationsDirectory(rootPath), operationId + ".json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPERATION_TYPES: readonly OperationType[] = ["install", "upgrade", "uninstall", "reindex"];

/** Validate and freeze a journal record read from disk before anyone trusts it. */
export function parseOperationJournalRecord(text: string, path: string): OperationJournalRecord {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ManifestError(path, "journal record is not valid JSON");
  }
  if (
    !isRecord(value) ||
    typeof value.operationId !== "string" ||
    !OPERATION_ID_PATTERN.test(value.operationId) ||
    typeof value.operationType !== "string" ||
    !OPERATION_TYPES.includes(value.operationType as OperationType) ||
    !isNonNegativeInteger(value.oldGeneration) ||
    !isNonNegativeInteger(value.targetGeneration) ||
    !isNonNegativeInteger(value.oldEffectiveRevision) ||
    !isNonNegativeInteger(value.targetEffectiveRevision) ||
    typeof value.oldManifest !== "string" ||
    typeof value.targetManifest !== "string" ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    throw new ManifestError(path, "journal record has an unsupported shape");
  }
  // The recovery payloads must be valid manifests; a corrupt preimage or
  // target image is an unrecoverable journal, not a recoverable one.
  parseManifest(value.oldManifest, path);
  parseManifest(value.targetManifest, path);
  return Object.freeze({
    operationId: value.operationId,
    operationType: value.operationType as OperationType,
    oldGeneration: value.oldGeneration,
    targetGeneration: value.targetGeneration,
    oldEffectiveRevision: value.oldEffectiveRevision,
    targetEffectiveRevision: value.targetEffectiveRevision,
    oldManifest: value.oldManifest,
    targetManifest: value.targetManifest,
    createdAt: value.createdAt,
  });
}

/** Build a journal record for an operation that will publish `targetManifest`. */
export function createOperationJournalRecord(
  operationType: OperationType,
  oldManifest: InstalledPacksManifest,
  targetManifest: InstalledPacksManifest,
): OperationJournalRecord {
  return Object.freeze({
    operationId: crypto.randomUUID(),
    operationType,
    oldGeneration: oldManifest.generation,
    targetGeneration: targetManifest.generation,
    oldEffectiveRevision: oldManifest.effectiveRevision,
    targetEffectiveRevision: targetManifest.effectiveRevision,
    oldManifest: serializeManifest(oldManifest),
    targetManifest: serializeManifest(targetManifest),
    createdAt: new Date().toISOString(),
  });
}

/** Atomically persist a journal record before the target manifest is published. */
export async function writeOperationJournal(
  rootPath: string,
  record: OperationJournalRecord,
): Promise<void> {
  const path = operationJournalPath(rootPath, record.operationId);
  const temporaryPath = path + ".tmp-" + crypto.randomUUID();
  await mkdir(operationsDirectory(rootPath), { recursive: true });
  try {
    await writeFile(temporaryPath, JSON.stringify(record), "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw new ManifestError(path, "cannot persist operation journal", error);
  }
}

/** Read a single journal record; throws ManifestError when absent or invalid. */
export async function readOperationJournal(
  rootPath: string,
  operationId: string,
): Promise<OperationJournalRecord> {
  const path = operationJournalPath(rootPath, operationId);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new ManifestError(path, "journal record cannot be read", error);
  }
  return parseOperationJournalRecord(text, path);
}

/** List persisted journal operation ids, oldest first. */
export async function listOperationJournals(rootPath: string): Promise<readonly string[]> {
  let entries;
  try {
    entries = await readdir(operationsDirectory(rootPath));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw new ManifestError(operationsDirectory(rootPath), "cannot list operation journals", error);
  }
  const operationIds = entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -".json".length))
    .filter((operationId) => OPERATION_ID_PATTERN.test(operationId))
    .sort();
  return operationIds;
}

/** Remove a journal record once the operation has converged (or rolled back). */
export async function clearOperationJournal(rootPath: string, operationId: string): Promise<void> {
  try {
    await unlink(operationJournalPath(rootPath, operationId));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return; // already cleared; idempotent
    }
    throw new ManifestError(
      operationJournalPath(rootPath, operationId),
      "cannot clear journal",
      error,
    );
  }
}
