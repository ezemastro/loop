import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_USER } from "../config.js";
import type { DatabaseConnection, DatabaseClient, NamedQuery } from "../types/dbClient.js";
import { InternalServerError } from "./errors.js";
import { ERROR_MESSAGES } from "../config.js";

const pool = new Pool({
  user: DB_USER,
  database: DB_NAME,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: 5432,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

class PostgresSession implements DatabaseClient {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async query<T extends QueryResultRow>(q: NamedQuery<T>, params?: unknown[]): Promise<T[]> {
    const result = await this.client.query<T>(q.text, params);
    return result.rows;
  }

  async begin() {
    await this.client.query("BEGIN");
  }

  async commit() {
    await this.client.query("COMMIT");
  }

  async rollback() {
    await this.client.query("ROLLBACK");
  }

  async release() {
    this.client.release();
  }
}

class PostgresClient implements DatabaseConnection {
  async connect(): Promise<DatabaseClient> {
    const client = await pool.connect();
    return new PostgresSession(client);
  }
}

export const dbConnection = new PostgresClient();

export async function withClient<T>(
  fn: (client: DatabaseClient) => Promise<T>,
  options?: { transaction?: boolean },
): Promise<T> {
  let client: DatabaseClient;
  try {
    client = await dbConnection.connect();
  } catch {
    throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
  }

  const cleanup = async (rollbackErr?: unknown) => {
    if (options?.transaction) {
      try {
        if (rollbackErr) await (client as PostgresSession).rollback();
        else await (client as PostgresSession).commit();
      } catch {
        // Transaction already ended
      }
    }
    try {
      await (client as PostgresSession).release();
    } catch {
      // Already released
    }
  };

  try {
    if (options?.transaction) {
      await (client as PostgresSession).begin();
    }
    const result = await fn(client);
    await cleanup();
    return result;
  } catch (err) {
    await cleanup(err);
    throw err;
  }
}
