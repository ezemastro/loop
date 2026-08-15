/**
 * Tests de `postgresClient`, que es la pieza de la que cuelga todo el aislamiento por comunidad.
 *
 * Lo que se verifica acá no lo puede verificar el compilador ni ningún otro test: el **orden** de
 * las operaciones sobre la conexión. Si `set_config` corriera después del `BEGIN`, un rollback
 * desharía el scope y la conexión volvería al pool con la comunidad equivocada — que es la forma
 * más silenciosa que tiene este sistema de filtrar datos entre comunidades.
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

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation((config: { user?: string }) => ({
    // Los dos pools se distinguen por el rol con el que se conectan.
    connect: jest.fn(async () =>
      config.user === "loop_app_unscoped" ? unscopedClient : scopedClient,
    ),
    query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
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

import { inCommunity, unscoped, withClient } from "./postgresClient";

const COMMUNITY_A = "11111111-1111-4111-8111-111111111111";

const texts = () => state.calls.map((c) => c.text);
const setConfigCalls = () => state.calls.filter((c) => c.text.includes("set_config"));

beforeEach(() => {
  state.calls = [];
  state.released = [];
  state.failSetConfig = false;
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
    expect(calls[1]?.params).toEqual(["app.community_id", ""]);
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

  it("exige el scope en tiempo de compilación", async () => {
    // @ts-expect-error — `options` es obligatorio a propósito: no hay default seguro para
    // "¿de qué comunidad son estos datos?". Si este error deja de aparecer, se perdió la garantía.
    await withClient(async () => undefined);
  });
});
