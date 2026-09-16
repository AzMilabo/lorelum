import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

export interface SqliteConnection<Schema extends Record<string, unknown>> {
  readonly client: Database;
  readonly orm: BunSQLiteDatabase<Schema>;
  close(): void;
}

export interface OpenSqliteConnectionOptions {
  readonly readonly?: boolean;
}

/**
 * Bun's `sqlite3_close_v2` leaves the connection as a zombie while statements
 * are outstanding, and drizzle-orm's bun-sqlite driver never finalizes the
 * statements it prepares. Those statements are only reclaimed by GC, so on
 * Windows the database file keeps an open handle — blocking rename or unlink —
 * until a collection happens. A synchronous collection at close releases the
 * handle deterministically; POSIX never blocked, so this stays Windows-only.
 */
export function closeSqliteClient(client: Database): void {
  client.close();
  if (process.platform === "win32") Bun.gc(true);
}

/** Wrap a caller-owned bun:sqlite client without changing its lifecycle. */
export function createSqliteConnection<Schema extends Record<string, unknown>>(
  client: Database,
  schema: Schema,
): SqliteConnection<Schema> {
  const orm = drizzle({ client, schema });
  return Object.freeze({
    client,
    orm,
    close() {
      closeSqliteClient(client);
    },
  });
}

/** The only Engine persistence entrypoint that creates a bun:sqlite handle. */
export function openSqliteConnection<Schema extends Record<string, unknown>>(
  path: string,
  schema: Schema,
  options: OpenSqliteConnectionOptions = {},
): SqliteConnection<Schema> {
  let client: Database | undefined;
  try {
    const opened =
      options.readonly === true ? new Database(path, { readonly: true }) : new Database(path);
    client = opened;
    return createSqliteConnection(opened, schema);
  } catch (error) {
    client?.close();
    throw error;
  }
}
