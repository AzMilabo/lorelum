import type { Database } from "bun:sqlite";

import type { RevisionDelta } from "../../model";

import { SqliteStateError } from "../errors";

export interface PendingRevisionNotification {
  readonly revision: number;
  readonly delta: RevisionDelta;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function serializeRevisionDelta(delta: RevisionDelta): string {
  return JSON.stringify({
    added: [...delta.added],
    changed: [...delta.changed],
    invalidated: [...delta.invalidated],
  });
}

function parseRevisionDelta(text: string): RevisionDelta {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new SqliteStateError("revision outbox delta is not JSON", error);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SqliteStateError("revision outbox delta has an unsupported shape");
  }
  const record = value as Record<string, unknown>;
  if (
    !isStringArray(record.added) ||
    !isStringArray(record.changed) ||
    !isStringArray(record.invalidated)
  ) {
    throw new SqliteStateError("revision outbox delta has an unsupported shape");
  }
  return Object.freeze({
    added: Object.freeze([...record.added]),
    changed: Object.freeze([...record.changed]),
    invalidated: Object.freeze([...record.invalidated]),
  });
}

/** Read durable notifications in revision order. */
export function readPendingRevisionNotifications(
  database: Database,
): readonly PendingRevisionNotification[] {
  try {
    const rows = database
      .query("SELECT revision, delta_json FROM effective_revision_outbox ORDER BY revision ASC")
      .all() as readonly Record<string, unknown>[];
    return Object.freeze(
      rows.map((row) => {
        if (
          typeof row.revision !== "number" ||
          !Number.isSafeInteger(row.revision) ||
          row.revision < 0 ||
          typeof row.delta_json !== "string"
        ) {
          throw new SqliteStateError("revision outbox row is malformed");
        }
        return Object.freeze({
          revision: row.revision,
          delta: parseRevisionDelta(row.delta_json),
        });
      }),
    );
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot read revision outbox", error);
  }
}

export function deletePendingRevisionNotification(database: Database, revision: number): void {
  try {
    database.query("DELETE FROM effective_revision_outbox WHERE revision = ?").run(revision);
  } catch (error) {
    throw new SqliteStateError("cannot acknowledge revision notification", error);
  }
}
