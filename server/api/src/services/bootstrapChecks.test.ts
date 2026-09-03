/**
 * Tests de `assertSuperAdminExists()` (BOOT-1, BOOT-2): warn-by-default cuando no hay ningún
 * `super_admin`, y hard-fail solo bajo `NODE_ENV === "production"` **y**
 * `REQUIRE_SUPER_ADMIN_ON_BOOT === true` a la vez.
 *
 * `withClient`/`unscoped` van mockeados en vez de `pg` (patrón alternativo al de
 * `postgresClient.test.ts:237`): lo que hay que probar acá es la lógica de warn/exit de
 * `bootstrapChecks.ts`, no el manejo de conexiones, que ya cubre `postgresClient.test.ts`.
 */

const mockState = {
  count: 1,
  nodeEnv: "development" as string,
  requireFlag: false,
};

jest.mock("../config.js", () => ({
  get NODE_ENV() {
    return mockState.nodeEnv;
  },
  get REQUIRE_SUPER_ADMIN_ON_BOOT() {
    return mockState.requireFlag;
  },
}));

jest.mock("./postgresClient.js", () => ({
  unscoped: (reason: string) => ({ mode: "unscoped", reason }),
  withClient: jest.fn(async (fn: (client: { query: jest.Mock }) => Promise<unknown>) =>
    fn({ query: jest.fn(async () => [{ count: mockState.count }]) }),
  ),
}));

import { assertSuperAdminExists } from "./bootstrapChecks";

describe("assertSuperAdminExists", () => {
  let errorSpy: jest.SpyInstance<void, Parameters<typeof console.error>>;

  beforeEach(() => {
    mockState.count = 1;
    mockState.nodeEnv = "development";
    mockState.requireFlag = false;
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("avisa por console.error y no bloquea el arranque cuando no hay ningún super_admin", async () => {
    mockState.count = 0;

    await expect(assertSuperAdminExists()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("super_admin");
  });

  it("no avisa nada cuando existe al menos un super_admin", async () => {
    mockState.count = 3;

    await assertSuperAdminExists();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("corta el arranque solo con NODE_ENV=production y la bandera prendida a la vez", async () => {
    mockState.count = 0;
    mockState.nodeEnv = "production";
    mockState.requireFlag = true;

    await expect(assertSuperAdminExists()).rejects.toThrow(/super_admin/);
  });

  it("en producción pero con la bandera apagada, avisa y no bloquea (warn-by-default)", async () => {
    mockState.count = 0;
    mockState.nodeEnv = "production";
    mockState.requireFlag = false;

    await expect(assertSuperAdminExists()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("con la bandera prendida fuera de producción, avisa y no bloquea", async () => {
    mockState.count = 0;
    mockState.nodeEnv = "development";
    mockState.requireFlag = true;

    await expect(assertSuperAdminExists()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
