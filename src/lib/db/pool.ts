import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * The dashboard runs with or without Postgres: with it, the board is served
 * from the database and the 42 API is only touched by the background jobs;
 * without it, the app falls back to building a payload per request (see
 * `dashboard-repository.ts`). `hasDatabase()` is the switch.
 */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // A dropped connection must not take the process down with it: the pool
    // discards the client and the next query opens a fresh one.
    pool.on("error", (error) => {
      console.error("[db] idle client error:", error.message);
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

let migrated: Promise<void> | null = null;

/**
 * Applies `schema.sql`. Every statement is `IF NOT EXISTS`, so this is safe to
 * run on every boot; the promise is memoised so concurrent callers share one run.
 */
export function migrate(): Promise<void> {
  migrated ??= (async () => {
    const sql = await readFile(
      path.join(process.cwd(), "src/lib/db/schema.sql"),
      "utf8",
    );
    await getPool().query(sql);
  })().catch((error) => {
    migrated = null;
    throw error;
  });
  return migrated;
}
