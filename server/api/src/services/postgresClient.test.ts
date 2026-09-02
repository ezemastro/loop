/**
 * Tests de `postgresClient`, que es la pieza de la que cuelga todo el aislamiento por comunidad.
 *
 * Lo que se verifica acá no lo puede verificar el compilador ni ningún otro test: el **orden** de
 * las operaciones sobre la conexión. Si `set_config` corriera después del `BEGIN`, un rollback
 * desharía el scope y la conexión volvería al pool con la comunidad equivocada — que es la forma
 * más silenciosa que tiene este sistema de filtrar datos entre comunidades.
 *
 * La segunda mitad cubre `assertDbHardening()`, el chequeo de arranque: rol sin RLS, tablas tenant
 * con RLS apagada y la matriz de privilegios de `loop_app` (SEC-09).
 */

/** Registro de todo lo que se le pidió a la conexión, en orden. */
type Call = { text: string; params?: unknown[] };

const state = {
  calls: [] as Call[],
  released: [] as boolean[],
  failSetConfig: false,
};

const makeClient = () => ({
  query: jest.fn(async (text: string, params?: unknown[]) => {
    state.calls.push({ text, ...(params ? { params } : {}) });
    if (state.failSetConfig && text.includes("set_config")) {
      throw new Error("fallo al fijar la comunidad");
    }
    return { rows: [] };
  }),
  release: jest.fn((destroy?: boolean) => {
    state.released.push(destroy === true);
  }),
});

const scopedClient = makeClient();
const unscopedClient = makeClient();

/**
 * Privilegios que `0013_revoke_loop_app_dml.sql` deja efectivamente en pie para `loop_app` sobre
 * las tablas sin RLS. Está escrito a mano a propósito: es la fuente independiente contra la que se
 * contrasta la matriz declarada en `postgresClient.ts`. Todo lo que no figure acá debe estar
 * revocado.
 */
const GRANTED_BY_0013 = new Set([
  "communities:SELECT",
  "community_email_domains:SELECT",
  "invitations:SELECT",
  "invitations:UPDATE",
]);

type RoleRow = { rolsuper: boolean; rolbypassrls: boolean; current_user: string };

/** Estado del catálogo del sistema que ve `assertDbHardening()` en cada test. */
const catalog = {
  role: null as RoleRow | null,
  tablesWithoutRls: [] as string[],
  /** Desvíos respecto de `GRANTED_BY_0013`, con clave `tabla:PRIVILEGIO`. */
  grantOverrides: new Map<string, boolean>(),
};

const hasGrant = (table: string, privilege: string): boolean =>
  catalog.grantOverrides.get(`${table}:${privilege}`) ??
  GRANTED_BY_0013.has(`${table}:${privilege}`);

/** Responde las tres consultas al catálogo que hace `assertDbHardening()`, en cualquier orden. */
const poolQuery = jest.fn(async (text: string, params?: unknown[]) => {
  if (text.includes("pg_roles")) {
    return { rows: catalog.role ? [catalog.role] : [] };
  }
  if (text.includes("relrowsecurity")) {
    return { rows: catalog.tablesWithoutRls.map((relname) => ({ relname })) };
  }
  if (text.includes("has_table_privilege")) {
    const [tables, privileges] = (params ?? []) as [string[], string[]];
    return {
      rows: tables.map((table, i) => ({ has: hasGrant(table, privileges[i] as string) })),
    };
  }
  return { rows: [], rowCount: 0 };
});

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation((config: { user?: string }) => ({
    // Los dos pools se distinguen por el rol con el que se conectan.
    connect: jest.fn(async () =>
      config.user === "loop_app_unscoped" ? unscopedClient : scopedClient,
    ),
    query: poolQuery,
    end: jest.fn(async () => undefined),
  })),
}));

jest.mock("../config.js", () => ({
  DB_APP_USER: "loop_app",
  DB_APP_PASSWORD: "x",
  DB_UNSCOPED_USER: "loop_app_unscoped",
  DB_UNSCOPED_PASSWORD: "x",
  DB_HOST: "localhost",
  DB_NAME: "loop_test",
  NODE_ENV: "test",
  ERROR_MESSAGES: { DATABASE_ERROR: "Error al conectar a la base de datos" },
}));

import { assertDbHardening, inCommunity, unscoped, withClient } from "./postgresClient";

const COMMUNITY_A = "11111111-1111-4111-8111-111111111111";

const texts = () => state.calls.map((c) => c.text);
const setConfigCalls = () => state.calls.filter((c) => c.text.includes("set_config"));

beforeEach(() => {
  state.calls = [];
  state.released = [];
  state.failSetConfig = false;
  catalog.role = { rolsuper: false, rolbypassrls: false, current_user: "loop_app" };
  catalog.tablesWithoutRls = [];
  catalog.grantOverrides = new Map();
  jest.clearAllMocks();
});

describe("withClient", () => {
  it("fija la comunidad al tomar la conexión", async () => {
    await withClient(async () => undefined, { scope: inCommunity(COMMUNITY_A) });

    const [first] = setConfigCalls();
    expect(first?.params).toEqual(["app.community_id", COMMUNITY_A]);
  });

  it("también fija la variable en modo unscoped, con valor vacío", async () => {
    // Es lo que garantiza que un valor viejo de otro request quede pisado: la limpieza del release
    // es higiene, no la protección real.
    await withClient(async () => undefined, { scope: unscoped("admin") });

    const [first] = setConfigCalls();
    expect(first?.params).toEqual(["app.community_id", ""]);
  });

  it("limpia la variable antes de devolver la conexión al pool", async () => {
    await withClient(async () => undefined, { scope: inCommunity(COMMUNITY_A) });

    const calls = setConfigCalls();
    expect(calls).toHaveLength(2);
    // El reset del release lleva el valor vacío **en el texto** (`set_config($1, '', false)`), no
    // como parámetro: el único parámetro es el nombre de la variable. Lo que importa es que la
    // segunda llamada deje `app.community_id` en vacío, no cómo viaja ese vacío.
    expect(calls[1]?.params).toEqual(["app.community_id"]);
    expect(calls[1]?.text).toContain("set_config($1, '', false)");
    expect(state.released).toEqual([false]);
  });

  it("fija la comunidad ANTES del BEGIN", async () => {
    await withClient(async () => undefined, {
      scope: inCommunity(COMMUNITY_A),
      transaction: true,
    });

    const orden = texts();
    const iSetConfig = orden.findIndex((t) => t.includes("set_config"));
    const iBegin = orden.indexOf("BEGIN");

    expect(iSetConfig).toBeGreaterThanOrEqual(0);
    expect(iBegin).toBeGreaterThanOrEqual(0);
    // Si fuera al revés, un ROLLBACK desharía el scope: `set_config` es transaccional.
    expect(iSetConfig).toBeLessThan(iBegin);
  });

  it("hace ROLLBACK y limpia la variable cuando la transacción falla", async () => {
    await expect(
      withClient(
        async () => {
          throw new Error("boom");
        },
        { scope: inCommunity(COMMUNITY_A), transaction: true },
      ),
    ).rejects.toThrow("boom");

    expect(texts()).toContain("ROLLBACK");
    expect(texts()).not.toContain("COMMIT");
  });

  it("destruye la conexión si no se pudo fijar la comunidad", async () => {
    // Devolver al pool una conexión a medio configurar sería peor que perderla: el siguiente
    // request la tomaría con el scope de otro.
    state.failSetConfig = true;

    await expect(
      withClient(async () => undefined, { scope: inCommunity(COMMUNITY_A) }),
    ).rejects.toBeDefined();

    expect(state.released).toEqual([true]);
  });

  it("expone communityId según el modo", async () => {
    const enComunidad = await withClient(async (client) => client.communityId, {
      scope: inCommunity(COMMUNITY_A),
    });
    const sinScope = await withClient(async (client) => client.communityId, {
      scope: unscoped("admin"),
    });

    expect(enComunidad).toBe(COMMUNITY_A);
    // `null` es lo que desactiva el predicado `($n IS NULL OR community_id = $n)` de las queries.
    expect(sinScope).toBeNull();
  });

  it("usa el pool con BYPASSRLS solo para las conexiones sin scope", async () => {
    await withClient(async () => undefined, { scope: inCommunity(COMMUNITY_A) });
    expect(scopedClient.query).toHaveBeenCalled();
    expect(unscopedClient.query).not.toHaveBeenCalled();

    jest.clearAllMocks();

    await withClient(async () => undefined, { scope: unscoped("auth:lookup-user") });
    expect(unscopedClient.query).toHaveBeenCalled();
    expect(scopedClient.query).not.toHaveBeenCalled();
  });

  it("exige el scope, y sin scope falla cerrado en runtime", async () => {
    const fn = jest.fn(async () => undefined);

    // @ts-expect-error — `options` es obligatorio a propósito: no hay default seguro para
    // "¿de qué comunidad son estos datos?". Si este error deja de aparecer, se perdió la garantía.
    await expect(withClient(fn)).rejects.toBeInstanceOf(Error);

    // Y si alguien esquiva al compilador (un caller en JS plano), tampoco corre sin scope: no se
    // llega a ejecutar el callback ni a tocar la conexión.
    expect(fn).not.toHaveBeenCalled();
    expect(state.calls).toHaveLength(0);
  });
});

/**
 * `assertDbHardening()` es el chequeo de arranque. Fuera de producción no tira: avisa por
 * `console.warn`, así que lo que se observa acá es exactamente lo que vería alguien levantando la
 * API con la base mal configurada.
 */
describe("assertDbHardening", () => {
  let warn: jest.SpyInstance<void, Parameters<typeof console.warn>>;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const reported = () => warn.mock.calls.map(([message]) => String(message)).join("\n");

  it("no reporta nada cuando el rol, la RLS y los privilegios están como los dejan las migraciones", async () => {
    await assertDbHardening();

    expect(warn).not.toHaveBeenCalled();
  });

  it("delata que la API se conecta con un rol que ignora RLS", async () => {
    // El caso real: apuntar la API al usuario de `POSTGRES_USER`, que es SUPERUSER.
    catalog.role = { rolsuper: true, rolbypassrls: false, current_user: "postgres" };

    await assertDbHardening();

    expect(reported()).toContain("SUPERUSER o tiene BYPASSRLS");
  });

  it("delata las tablas tenant que quedaron sin RLS", async () => {
    catalog.tablesWithoutRls = ["listings", "messages"];

    await assertDbHardening();

    expect(reported()).toContain("RLS deshabilitada en: listings, messages");
  });

  it("delata que a loop_app le falta UPDATE en invitations", async () => {
    // Es la fila que más importa de la matriz: `SELECT … FOR UPDATE` —el lock que hace que una
    // invitación se use una sola vez— exige UPDATE. Revocarlo de más rompe el registro por
    // invitación en producción, y sin este assert solo se vería como un 42501 en el primer intento.
    catalog.grantOverrides.set("invitations:UPDATE", false);

    await assertDbHardening();

    expect(reported()).toContain("falta el privilegio UPDATE en invitations");
  });

  it("delata un privilegio de más sobre una tabla que loop_app no debería tocar", async () => {
    catalog.grantOverrides.set("admins:SELECT", true);

    await assertDbHardening();

    expect(reported()).toContain("privilegio SELECT de más en admins");
  });
});
