/**
 * Prueba que el aislamiento por comunidad sea real **a nivel de base de datos**.
 *
 * No pasa por la API a propósito: abre una conexión cruda con el rol de la aplicación y trata de
 * salirse de su comunidad a mano. Es lo único que demuestra que Row-Level Security está haciendo
 * algo — todos los demás tests podrían pasar con las policies apagadas, porque el filtro explícito
 * de las queries los cubriría igual.
 *
 * Necesita una base con las migraciones aplicadas. Como no siempre hay uno a mano, el suite se
 * saltea salvo que se pida explícitamente:
 *
 *     cd server/api
 *     RUN_DB_TESTS=1 npm test -- src/tests/rls.test.ts
 *
 * Usa las mismas variables de entorno que la app (`.env` de la raíz): `POSTGRES_*` para el rol
 * dueño, que siembra los datos, y `DB_APP_*` para el rol sujeto a RLS, que es el que se pone a
 * prueba.
 */
import { Client } from "pg";
import {
  DB_APP_PASSWORD,
  DB_APP_USER,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_USER,
} from "../config.js";
import { TENANT_TABLES } from "../services/postgresClient.js";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const describeDb = shouldRun ? describe : describe.skip;

const SUFFIX = `rls-${Date.now()}`;
const connect = (user?: string, password?: string) =>
  new Client({ user, password, database: DB_NAME, host: DB_HOST, port: 5432 });

describeDb("Row-Level Security", () => {
  /** Rol dueño: siembra y limpia. Al no ser el rol de la app, no está sujeto a las policies. */
  let owner: Client;
  /** Rol de la aplicación: el que tiene que quedar encerrado en su comunidad. */
  let app: Client;

  const ids = {
    communityA: "",
    communityB: "",
    userA: "",
    userB: "",
    listingA: "",
    listingB: "",
    categoryId: "",
  };

  beforeAll(async () => {
    owner = connect(DB_USER, DB_PASSWORD);
    app = connect(DB_APP_USER, DB_APP_PASSWORD);
    await owner.connect();
    await app.connect();

    const community = async (slug: string) => {
      const { rows } = await owner.query<{ id: string }>(
        `INSERT INTO communities (slug, name) VALUES ($1, $2) RETURNING id`,
        [`${SUFFIX}-${slug}`, `RLS ${slug}`],
      );
      return rows[0]!.id;
    };
    const user = async (communityId: string, email: string) => {
      const { rows } = await owner.query<{ id: string }>(
        `INSERT INTO users (email, first_name, last_name, community_id)
         VALUES ($1, 'RLS', 'Test', $2) RETURNING id`,
        [`${SUFFIX}-${email}`, communityId],
      );
      return rows[0]!.id;
    };
    const listing = async (communityId: string, sellerId: string) => {
      const { rows } = await owner.query<{ id: string }>(
        `INSERT INTO listings
           (title, description, price_credits, category_id, seller_id, product_status, listing_status, community_id)
         VALUES ('RLS', NULL, 1, $1, $2, 'good', 'published', $3) RETURNING id`,
        [ids.categoryId, sellerId, communityId],
      );
      return rows[0]!.id;
    };

    // Categoría compartida: el catálogo no está scopeado, así que sirve para las dos comunidades.
    const { rows: categoryRows } = await owner.query<{ id: string }>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
      [`${SUFFIX}-cat`],
    );
    ids.categoryId = categoryRows[0]!.id;

    ids.communityA = await community("a");
    ids.communityB = await community("b");
    ids.userA = await user(ids.communityA, "a@test.local");
    ids.userB = await user(ids.communityB, "b@test.local");
    ids.listingA = await listing(ids.communityA, ids.userA);
    ids.listingB = await listing(ids.communityB, ids.userB);
  });

  afterAll(async () => {
    if (owner) {
      // Las FK de community_id son ON DELETE CASCADE, así que borrar la comunidad arrastra el resto.
      await owner.query(`DELETE FROM listings WHERE community_id = ANY($1::uuid[])`, [
        [ids.communityA, ids.communityB],
      ]);
      await owner.query(`DELETE FROM users WHERE community_id = ANY($1::uuid[])`, [
        [ids.communityA, ids.communityB],
      ]);
      await owner.query(`DELETE FROM communities WHERE slug LIKE $1`, [`${SUFFIX}-%`]);
      await owner.query(`DELETE FROM categories WHERE name = $1`, [`${SUFFIX}-cat`]);
      await owner.end();
    }
    if (app) await app.end();
  });

  const scopeTo = (communityId: string) =>
    app.query("SELECT set_config('app.community_id', $1, false)", [communityId]);

  it("el rol de la aplicación NO es superusuario ni tiene BYPASSRLS", async () => {
    // Es el hallazgo que hace o rompe todo el diseño: en la imagen oficial de Postgres, el usuario
    // de POSTGRES_USER es superusuario, y los superusuarios ignoran RLS por completo.
    const { rows } = await app.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("RLS está habilitada en todas las tablas con datos de comunidad", async () => {
    const { rows } = await app.query<{ relname: string }>(
      `SELECT relname FROM pg_class
       WHERE relname = ANY($1::text[]) AND relkind = 'r' AND NOT relrowsecurity`,
      [[...TENANT_TABLES]],
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("no devuelve filas de otra comunidad en un listado", async () => {
    await scopeTo(ids.communityA);
    const { rows } = await app.query<{ id: string }>(`SELECT id FROM listings`);
    const encontrados = rows.map((r) => r.id);
    expect(encontrados).toContain(ids.listingA);
    expect(encontrados).not.toContain(ids.listingB);
  });

  it("no devuelve una fila de otra comunidad ni pidiéndola por id", async () => {
    await scopeTo(ids.communityA);
    const { rowCount } = await app.query(`SELECT * FROM listings WHERE id = $1`, [ids.listingB]);
    expect(rowCount).toBe(0);
  });

  it("no deja insertar en otra comunidad", async () => {
    await scopeTo(ids.communityA);
    await expect(
      app.query(
        `INSERT INTO listings
           (title, description, price_credits, category_id, seller_id, product_status, listing_status, community_id)
         VALUES ('intruso', NULL, 1, $1, $2, 'good', 'published', $3)`,
        [ids.categoryId, ids.userB, ids.communityB],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("no deja mover una fila propia a otra comunidad", async () => {
    // `WITH CHECK` mira el valor resultante, no solo el original.
    await scopeTo(ids.communityA);
    await expect(
      app.query(`UPDATE listings SET community_id = $1 WHERE id = $2`, [
        ids.communityB,
        ids.listingA,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("sin comunidad fijada no se ve absolutamente nada (fail-closed)", async () => {
    // Es la propiedad más importante: olvidarse del scope produce listas vacías, nunca una fuga.
    await app.query("SELECT set_config('app.community_id', '', false)");
    for (const tabla of TENANT_TABLES) {
      // `media` es la excepción: community_id nulo = recurso compartido (logos).
      if (tabla === "media") continue;
      const { rows } = await app.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${tabla}`);
      expect({ tabla, n: rows[0]?.n }).toEqual({ tabla, n: "0" });
    }
  });

  it("los catálogos compartidos se ven desde cualquier comunidad", async () => {
    await scopeTo(ids.communityA);
    const desdeA = await app.query(`SELECT id FROM categories WHERE id = $1`, [ids.categoryId]);
    await scopeTo(ids.communityB);
    const desdeB = await app.query(`SELECT id FROM categories WHERE id = $1`, [ids.categoryId]);
    expect(desdeA.rowCount).toBe(1);
    expect(desdeB.rowCount).toBe(1);
  });
});
