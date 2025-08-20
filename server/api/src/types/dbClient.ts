import type { QueryResultRow } from "pg";
import type { queries } from "../services/queries";

export type Queries = typeof queries;

type QueryKey = string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface NamedQuery<T> {
  key: QueryKey;
  text: string;
}

export interface DatabaseClient {
  query<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ): Promise<T[]>;

  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface DatabaseConnection {
  connect(): Promise<DatabaseClient>;
}
