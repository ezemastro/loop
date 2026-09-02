import { Pool, type PoolClient, type QueryResultRow } from "pg";
import {
  DB_APP_PASSWORD,
  DB_APP_USER,
  DB_HOST,
  DB_NAME,
  DB_PORT,
  DB_UNSCOPED_PASSWORD,
  DB_UNSCOPED_USER,
  ERROR_MESSAGES,
  NODE_ENV,
} from "../config.js";
import type {
  DatabaseClient,
  DatabaseConnection,
  DbScope,
  NamedQuery,
  WithClientOptions,
} from "../types/dbClient.js";
import { InternalServerError } from "./errors.js";

/**
 * Variable de sesión que leen todas las policies de RLS a través de `app_community_id()`.
 * Se fija al tomar la conexión del pool, nunca dentro de una transacción (ver más abajo).
 */
const COMMUNITY_GUC = "app.community_id";

/** Tablas con RLS. Debe coincidir con el loop de `0007_db_roles_and_rls.sql`. */
export const TENANT_TABLES = [
  "schools",
  "users",
  "user_schools",
  "listings",
  "listing_media",
  "listing_trades",
  "messages",
  "notifications",
  "user_missions",
  "wallet_transactions",
  "users_wishes",
  "global_stats",
  "media",
] as const;

const poolConfig = {
  database: DB_NAME,
  host: DB_HOST,
  port: DB_PORT,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

/** Rol sujeto a RLS: atiende todo el tráfico de usuarios. */
const scopedPool = new Pool({
  ...poolConfig,
  user: DB_APP_USER,
  password: DB_APP_PASSWORD,
  max: 10,
});

/** Rol con BYPASSRLS: solo auth, panel de admin y catálogos públicos. Pool chico a propósito. */
const unscopedPool = new Pool({
  ...poolConfig,
  user: DB_UNSCOPED_USER,
  password: DB_UNSCOPED_PASSWORD,
  max: 4,
});

class PostgresSession implements DatabaseClient {
  private client: PoolClient;
  readonly scope: DbScope;

  constructor(client: PoolClient, scope: DbScope) {
    this.client = client;
    this.scope = scope;
  }

  get communityId(): UUID | null {
    return this.scope.mode === "community" ? this.scope.communityId : null;
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
    try {
      // Higiene: la protección real es que `connect` lo fija en cada toma (ver nota abajo).
      await this.client.query("SELECT set_config($1, '', false)", [COMMUNITY_GUC]);
      this.client.release();
    } catch {
      // Si no pudimos limpiar, destruimos la conexión en lugar de devolverla al pool.
      this.client.release(true);
    }
  }
}

class PostgresClient implements DatabaseConnection {
  async connect(scope: DbScope): Promise<DatabaseClient> {
    const pool = scope.mode === "community" ? scopedPool : unscopedPool;
    const client = await pool.connect();

    try {
      // `is_local = false` fija la variable a nivel de **sesión**, que es lo que corresponde:
      // la mayoría de los usos no abren transacción, y `SET LOCAL` se descartaría.
      //
      // Se fija SIEMPRE, incluso en modo unscoped. Eso —y no el reset del release— es lo que
      // garantiza que un valor viejo de otro request quede pisado antes de la primera query.
      await client.query("SELECT set_config($1, $2, false)", [
        COMMUNITY_GUC,
        scope.mode === "community" ? scope.communityId : "",
      ]);
    } catch (err) {
      // Nunca devolver al pool una conexión a medio configurar.
      client.release(true);
      throw err;
    }

    return new PostgresSession(client, scope);
  }
}

export const dbConnection = new PostgresClient();

/**
 * Toma una conexión, la deja scopeada a una comunidad y ejecuta `fn`.
 *
 * `options` es **obligatorio** a propósito: no existe un default seguro para "¿de qué comunidad son
 * estos datos?", y hacerlo requerido convierte al compilador en la lista de verificación de la
 * migración.
 *
 * Orden de operaciones (importa):
 *
 *     connect → set_config → BEGIN → fn() → COMMIT/ROLLBACK → set_config('') → release
 *
 * Nunca `BEGIN` antes de `set_config`: `set_config` es transaccional, así que un rollback
 * desharía el scope y la conexión volvería al pool con la comunidad equivocada.
 */
export async function withClient<T>(
  fn: (client: DatabaseClient) => Promise<T>,
  options: WithClientOptions,
): Promise<T> {
  let client: DatabaseClient;
  try {
    client = await dbConnection.connect(options.scope);
  } catch {
    throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
  }

  const cleanup = async (rollbackErr?: unknown) => {
    if (options.transaction) {
      try {
        if (rollbackErr) await client.rollback();
        else await client.commit();
      } catch {
        // La transacción ya había terminado.
      }
    }
    try {
      await client.release();
    } catch {
      // Ya estaba liberada.
    }
  };

  try {
    if (options.transaction) {
      await client.begin();
    }
    const result = await fn(client);
    await cleanup();
    return result;
  } catch (err) {
    await cleanup(err);
    throw err;
  }
}

/** Atajo legible para los caminos que no pueden estar scopeados. */
export const unscoped = (reason: Extract<DbScope, { mode: "unscoped" }>["reason"]): DbScope => ({
  mode: "unscoped",
  reason,
});

/** Atajo legible para el caso normal. */
export const inCommunity = (communityId: UUID): DbScope => ({ mode: "community", communityId });

/**
 * Verifica al arrancar que el aislamiento realmente está activo.
 *
 * Existe por un motivo concreto: en la imagen oficial de Postgres, el usuario de `POSTGRES_USER`
 * es SUPERUSER, y los superusuarios ignoran RLS. Si alguien vuelve a apuntar la API a ese rol —o
 * si una migración no llegó a correr— las policies quedarían sin efecto y **nada lo delataría**.
 * Esto lo convierte en un fallo de arranque ruidoso.
 */
export const assertDbHardening = async () => {
  const problems: string[] = [];

  const { rows: roleRows } = await scopedPool.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    current_user: string;
  }>(
    `SELECT rolsuper, rolbypassrls, current_user
     FROM pg_roles WHERE rolname = current_user`,
  );
  const role = roleRows[0];

  if (!role) {
    problems.push("no se pudo determinar el rol con el que se conecta la API");
  } else if (role.rolsuper || role.rolbypassrls) {
    problems.push(
      `la API se conecta como "${role.current_user}", que es SUPERUSER o tiene BYPASSRLS: ` +
        `las policies de RLS no se aplicarían`,
    );
  }

  const { rows: rlsRows } = await scopedPool.query<{ relname: string }>(
    `SELECT relname FROM pg_class
     WHERE relname = ANY($1::text[]) AND relkind = 'r' AND NOT relrowsecurity`,
    [[...TENANT_TABLES]],
  );
  if (rlsRows.length > 0) {
    problems.push(`RLS deshabilitada en: ${rlsRows.map((r) => r.relname).join(", ")}`);
  }

  // Prueba de humo del fail-closed: sin comunidad fijada, no se ve ninguna fila.
  const probe = await scopedPool.connect();
  try {
    await probe.query("SELECT set_config($1, '', false)", [COMMUNITY_GUC]);
    const { rows } = await probe.query<{ n: string }>("SELECT count(*)::text AS n FROM listings");
    if (rows[0] && rows[0].n !== "0") {
      problems.push(
        `sin comunidad fijada se ven ${rows[0].n} publicaciones: el aislamiento no está activo`,
      );
    }
  } finally {
    probe.release(true);
  }

  if (problems.length > 0) {
    const message = `Aislamiento por comunidad mal configurado:\n  - ${problems.join("\n  - ")}`;
    if (NODE_ENV === "production") throw new Error(message);
    console.warn(`\n⚠️  ${message}\n`);
  }
};

/** Cierra los pools. Usado por el teardown de los tests. */
export const closePools = async () => {
  await Promise.allSettled([scopedPool.end(), unscopedPool.end()]);
};
