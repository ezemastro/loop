import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { DB_NAME, DB_PASSWORD, DB_USER } from "../config.js";
import type { NamedQuery } from "../types/models.js";

const pool = new Pool({
  user: DB_USER,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: 5432,
});

const connect = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};

const release = async (client: PoolClient) => {
  client.release();
};

const begin = async (client: PoolClient) => {
  await client.query("BEGIN");
  return client;
};

const commit = async (client: PoolClient) => {
  await client.query("COMMIT");
  return client;
};

const rollback = async (client: PoolClient) => {
  await client.query("ROLLBACK");
  return client;
};

const query = async <T extends QueryResultRow>(
  client: PoolClient,
  q: NamedQuery<T>,
  params?: unknown[],
) => {
  const result = await client.query<T>(q.text, params);
  return result;
};

const bind = (client: PoolClient) => ({
  query: <T extends QueryResultRow>(q: NamedQuery<T>, params?: unknown[]) =>
    query<T>(client, q, params),

  exists: async (q: NamedQuery<{ exists: boolean }>, params?: unknown[]) => {
    const { rows } = await query(client, q, params);
    return !!rows[0]?.exists;
  },

  one: async <T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ) => {
    const { rows } = await query<T>(client, q, params);
    if (!rows[0]) throw new Error(`Expected one row for ${q.key}, got 0`);
    return rows[0];
  },

  maybeOne: async <T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ) => {
    const { rows } = await query<T>(client, q, params);
    return rows[0] ?? null;
  },

  many: async <T extends QueryResultRow>(
    q: NamedQuery<T>,
    params?: unknown[],
  ) => {
    const { rows } = await query<T>(client, q, params);
    return rows;
  },

  paginate: async <T extends QueryResultRow>(
    q: NamedQuery<T>,
    params: unknown[] = [],
    page: number = 1,
    pageSize: number = 10,
  ) => {
    const offset = (page - 1) * pageSize;

    // Traer registros paginados
    const { rows } = await query<T>(
      client,
      {
        ...q,
        text: `${q.text} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      },
      [...params, pageSize, offset],
    );

    // Calcular total
    const countQuery = {
      key: `${q.key}_count`,
      text: `SELECT COUNT(*)::int as total FROM (${q.text}) as sub`,
    };
    const { rows: countRows } = await query<{ total: number }>(
      client,
      countQuery,
      params,
    );
    const totalRecords = countRows[0]?.total ?? 0;

    const totalPages = Math.ceil(totalRecords / pageSize);

    return {
      data: rows,
      pagination: {
        total_records: totalRecords,
        current_page: page,
        page_size: pageSize,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null,
      },
    };
  },
});

export default {
  connect,
  release,
  begin,
  commit,
  rollback,
  bind,
};
