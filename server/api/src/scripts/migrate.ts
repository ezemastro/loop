/**
 * Runner de migraciones mínimo.
 *
 * - Aplica en orden alfabético los archivos `server/migrations/*.sql` que todavía no estén
 *   registrados en `schema_migrations`.
 * - Cada archivo corre dentro de su propia transacción, salvo que su primera línea sea
 *   `-- migrate:no-transaction` (necesario para `CREATE INDEX CONCURRENTLY`).
 * - Un advisory lock serializa el runner: es seguro que arranquen varios contenedores a la vez.
 * - De las migraciones ya aplicadas se verifica el checksum; si un archivo cambió, aborta.
 *
 * Se conecta con el rol **dueño** de las tablas (POSTGRES_USER), no con el rol de aplicación:
 * las migraciones necesitan DDL y el rol de app deliberadamente no lo tiene.
 *
 *   npm run migrate           aplica las pendientes
 *   npm run migrate:status    lista el estado sin aplicar nada
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import {
  AUTHORIZED_ADMIN_EMAIL,
  DB_APP_PASSWORD,
  DB_APP_USER,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_UNSCOPED_PASSWORD,
  DB_UNSCOPED_USER,
  DB_USER,
} from "../config.js";

// Lock arbitrario pero estable: cualquier valor sirve mientras sea el mismo en todos los procesos.
const ADVISORY_LOCK_KEY = 72610001;
const NO_TRANSACTION_PRAGMA = /^--\s*migrate:no-transaction/;

const resolveMigrationsDir = () => {
  if (process.env.MIGRATIONS_DIR) return path.resolve(process.env.MIGRATIONS_DIR);
  // `npm run migrate` corre desde server/api; en el contenedor el cwd puede ser /app/server/api.
  const candidates = [
    path.resolve(process.cwd(), "../migrations"),
    path.resolve(process.cwd(), "server/migrations"),
    path.resolve(process.cwd(), "migrations"),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(
      `No se encontró el directorio de migraciones. Probé: ${candidates.join(", ")}. ` +
        `Definí MIGRATIONS_DIR para forzarlo.`,
    );
  }
  return found;
};

interface MigrationFile {
  version: string;
  filePath: string;
  sql: string;
  checksum: string;
  useTransaction: boolean;
}

const readMigrations = (dir: string): MigrationFile[] =>
  fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const filePath = path.join(dir, file);
      const sql = fs.readFileSync(filePath, "utf8");
      return {
        version: file.replace(/\.sql$/, ""),
        filePath,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
        useTransaction: !NO_TRANSACTION_PRAGMA.test(sql.split("\n")[0] ?? ""),
      };
    });

/**
 * Parte un archivo SQL en sentencias individuales, respetando strings (con o sin dollar-quoting)
 * y comentarios. Solo se usa para las migraciones `-- migrate:no-transaction`:
 * `client.query()` con el archivo completo viaja por el protocolo simple de PostgreSQL y el
 * servidor envuelve las sentencias múltiples en una transacción implícita — que es exactamente
 * lo que `CREATE INDEX CONCURRENTLY` no permite.
 */
const splitStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      const comment = end === -1 ? sql.slice(i) : sql.slice(i, end);
      current += comment;
      i += comment.length;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      const comment = end === -1 ? sql.slice(i) : sql.slice(i, end + 2);
      current += comment;
      i += comment.length;
      continue;
    }
    if (ch === "'") {
      const end = sql.indexOf("'", i + 1);
      if (end === -1) {
        current += sql.slice(i);
        i = sql.length;
      } else {
        current += sql.slice(i, end + 1);
        i = end + 1;
      }
      continue;
    }
    const dollarTag = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
    if (dollarTag) {
      const tag = dollarTag[0];
      const end = sql.indexOf(tag, i + tag.length);
      if (end === -1) {
        current += sql.slice(i);
        i = sql.length;
      } else {
        current += sql.slice(i, end + tag.length);
        i = end + tag.length;
      }
      continue;
    }
    if (ch === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  const last = current.trim();
  if (last) statements.push(last);
  return statements;
};

const ensureMigrationsTable = async (client: Client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "version"    TEXT PRIMARY KEY,
      "checksum"   TEXT NOT NULL,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const getApplied = async (client: Client) => {
  const { rows } = await client.query<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM schema_migrations`,
  );
  return new Map(rows.map((row) => [row.version, row.checksum]));
};

/**
 * Expone al SQL de las migraciones los valores que no pueden estar hardcodeados.
 * Se leen con `current_setting('app.<clave>', true)`; nunca se interpola texto en el SQL.
 */
const exposeMigrationSettings = async (client: Client) => {
  const settings: Record<string, string> = {
    "app.authorized_admin_email": AUTHORIZED_ADMIN_EMAIL ?? "",
    "app.db_app_user": DB_APP_USER,
    "app.db_app_password": DB_APP_PASSWORD,
    "app.db_unscoped_user": DB_UNSCOPED_USER,
    "app.db_unscoped_password": DB_UNSCOPED_PASSWORD,
  };
  for (const [key, value] of Object.entries(settings)) {
    await client.query("SELECT set_config($1, $2, false)", [key, value]);
  }
};

const printStatus = (migrations: MigrationFile[], applied: Map<string, string>) => {
  console.log(`\nMigraciones (${migrations.length}):\n`);
  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.version);
    if (!appliedChecksum) {
      console.log(`  [ pendiente ] ${migration.version}`);
    } else if (appliedChecksum !== migration.checksum) {
      console.log(`  [ CHECKSUM! ] ${migration.version} — el archivo cambió después de aplicarse`);
    } else {
      console.log(`  [ aplicada  ] ${migration.version}`);
    }
  }
  console.log("");
};

const run = async () => {
  const statusOnly = process.argv.includes("--status");
  const dir = resolveMigrationsDir();
  const migrations = readMigrations(dir);

  const client = new Client({
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    host: DB_HOST,
    port: 5432,
  });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    if (statusOnly) {
      printStatus(migrations, applied);
      return;
    }

    for (const migration of migrations) {
      const appliedChecksum = applied.get(migration.version);

      if (appliedChecksum) {
        if (appliedChecksum !== migration.checksum) {
          throw new Error(
            `La migración ${migration.version} ya fue aplicada pero su archivo cambió ` +
              `(checksum ${appliedChecksum.slice(0, 12)} → ${migration.checksum.slice(0, 12)}). ` +
              `Nunca edites una migración aplicada: creá una nueva.`,
          );
        }
        continue;
      }

      const startedAt = Date.now();
      console.log(`→ Aplicando ${migration.version}...`);
      await exposeMigrationSettings(client);

      if (migration.useTransaction) {
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query(
            `INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)`,
            [migration.version, migration.checksum],
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      } else {
        // Sin transacción: si falla a mitad de camino queda parcialmente aplicada. Por eso estas
        // migraciones deben ser idempotentes (CREATE INDEX CONCURRENTLY IF NOT EXISTS).
        // Se manda sentencia por sentencia: el archivo completo en un solo query crearía una
        // transacción implícita, y CONCURRENTLY no puede correr dentro de ninguna.
        for (const statement of splitStatements(migration.sql)) {
          await client.query(statement);
        }
        await client.query(`INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)`, [
          migration.version,
          migration.checksum,
        ]);
      }

      console.log(`  ✓ ${migration.version} (${Date.now() - startedAt}ms)`);
    }

    console.log("\nMigraciones al día.\n");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    await client.end();
  }
};

run().catch((err) => {
  console.error("\n✗ Falló la migración:\n", err instanceof Error ? err.message : err);
  process.exit(1);
});
