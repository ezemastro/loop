import type { PoolClient, QueryResultRow } from "pg";

// Nombre para cada query (clave humanamente legible)
export type QueryKey = string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface NamedQuery<T> {
  key: QueryKey;
  text: string;
}

export type QueryResult<T> = { rows: T[] };

interface BoundDatabaseClient {
  query<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  exists(
    q: NamedQuery<{ exists: boolean }>,
    params?: unknown[],
  ): Promise<boolean>;
  one<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ): Promise<T>;
  maybeOne<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ): Promise<T | null>;
  many<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ): Promise<T[]>;
  paginate<T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
    page?: number,
    pageSize?: number,
  ): Promise<{
    data: T[];
    pagination: {
      total_records: number;
      current_page: number;
      page_size: number;
      total_pages: number;
      next_page: number | null;
      prev_page: number | null;
    };
  }>;
}

export interface DatabaseService {
  connect(): Promise<PoolClient>;
  release(client: PoolClient): void;
  begin(client: PoolClient): Promise<PoolClient>;
  commit(client: PoolClient): Promise<PoolClient>;
  rollback(client: PoolClient): Promise<PoolClient>;
  bind(client: PoolClient): BoundDatabaseClient;
}

export interface AuthRegisterPayload {
  firstName: string;
  lastName: string;
  password: string;
  schoolId: string;
  roleId: string;
  email: string;
}
export interface AuthLoginPayload {
  email: string;
  password: string;
}

export interface AuthModelInstance {
  registerUser: (data: AuthRegisterPayload) => Promise<{ user: User }>;
  loginUser: (data: AuthLoginPayload) => Promise<{ user: User }>;
}

export interface AuthModelQueries {
  userExists: NamedQuery<{ exists: boolean }>;
  insertUser: NamedQuery<{ id: UUID }>;
  schoolById: NamedQuery<DB_Schools>;
  roleById: NamedQuery<DB_Roles>;
  userByEmail: NamedQuery<DB_Users>;
}

export interface AuthModelConstructor {
  new ({
    database,
    queries,
  }: {
    database: DatabaseService;
    queries: AuthModelQueries;
  }): AuthModelInstance;
}
