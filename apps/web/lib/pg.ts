import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __RONDAFLOW_PG_POOL__: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  return new Pool({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: false
          }
        : undefined
  });
}

export function getPgPool() {
  if (!globalThis.__RONDAFLOW_PG_POOL__) {
    globalThis.__RONDAFLOW_PG_POOL__ = createPool();
  }
  return globalThis.__RONDAFLOW_PG_POOL__;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) {
  return getPgPool().query<T>(text, values);
}

type TxCallback<T> = (client: PoolClient) => Promise<T>;

export async function withTransaction<T>(callback: TxCallback<T>) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // noop
    }
    throw error;
  } finally {
    client.release();
  }
}

export type DbClient = PoolClient;
export type DbResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
