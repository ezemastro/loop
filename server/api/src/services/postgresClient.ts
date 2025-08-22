import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { DB_NAME, DB_PASSWORD, DB_USER } from "../config.js";
import type {
  DatabaseConnection,
  DatabaseClient,
  NamedQuery,
} from "../types/dbClient.js";

const pool = new Pool({
  user: DB_USER,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: 5432,
});

class PostgresSession implements DatabaseClient {
  private client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  async query<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ): Promise<T[]> {
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
