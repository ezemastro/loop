import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { areSchoolsInCommunity, emailBelongsToCommunity, extractDomain } from "./communities";

/**
 * La resolución de comunidad por dominio es lo que reemplazó a la constante `VALID_EMAIL_DOMAINS`.
 * Como ahora el dominio del correo es lo que decide en qué comunidad entra alguien, un error de
 * parsing acá manda usuarios a la comunidad equivocada.
 */

const COMMUNITY_A = "11111111-1111-4111-8111-111111111111";
const COMMUNITY_B = "22222222-2222-4222-8222-222222222222";

const makeClient = (rows: unknown[]) =>
  ({
    query: jest.fn(async () => rows),
    begin: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    scope: { mode: "community", communityId: COMMUNITY_A },
    communityId: COMMUNITY_A,
  }) as unknown as DatabaseClient;

describe("extractDomain", () => {
  it.each([
    ["alguien@northfield.edu.ar", "northfield.edu.ar"],
    ["  Alguien@Northfield.EDU.ar  ", "northfield.edu.ar"],
    ["alguien@sub.colegio.edu.ar", "sub.colegio.edu.ar"],
  ])("normaliza %s", (email, expected) => {
    expect(extractDomain(email)).toBe(expected);
  });

  it.each([
    ["sin-arroba", "no tiene @"],
    ["dos@arrobas@aca", "tiene más de una @"],
    ["alguien@", "no tiene dominio"],
    ["", "está vacío"],
  ])("devuelve null cuando %s (%s)", (email) => {
    expect(extractDomain(email)).toBeNull();
  });
});

describe("emailBelongsToCommunity", () => {
  it("acepta un correo cuyo dominio es de la comunidad", async () => {
    const client = makeClient([{ id: COMMUNITY_A }]);
    await expect(
      emailBelongsToCommunity({ client, email: "a@northfield.edu.ar", communityId: COMMUNITY_A }),
    ).resolves.toBe(true);
    expect(client.query).toHaveBeenCalledWith(queries.communityByDomain, ["northfield.edu.ar"]);
  });

  it("rechaza un dominio que pertenece a OTRA comunidad", async () => {
    // El caso que importa: el dominio existe, pero no es de esta comunidad.
    const client = makeClient([{ id: COMMUNITY_B }]);
    await expect(
      emailBelongsToCommunity({ client, email: "a@acme.edu.ar", communityId: COMMUNITY_A }),
    ).resolves.toBe(false);
  });

  it("rechaza un dominio desconocido", async () => {
    await expect(
      emailBelongsToCommunity({
        client: makeClient([]),
        email: "a@gmail.com",
        communityId: COMMUNITY_A,
      }),
    ).resolves.toBe(false);
  });

  it("rechaza un correo mal formado sin consultar la base", async () => {
    const client = makeClient([{ id: COMMUNITY_A }]);
    await expect(
      emailBelongsToCommunity({ client, email: "no-es-un-correo", communityId: COMMUNITY_A }),
    ).resolves.toBe(false);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe("areSchoolsInCommunity", () => {
  const schoolA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const schoolB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("acepta cuando todos los colegios son de la comunidad", async () => {
    await expect(
      areSchoolsInCommunity({
        client: makeClient([{ count: "2" }]),
        schoolIds: [schoolA, schoolB],
        communityId: COMMUNITY_A,
      }),
    ).resolves.toBe(true);
  });

  it("rechaza si alguno no es de la comunidad", async () => {
    // La base solo contó uno de los dos ⇒ el otro es de otra comunidad o no existe.
    await expect(
      areSchoolsInCommunity({
        client: makeClient([{ count: "1" }]),
        schoolIds: [schoolA, schoolB],
        communityId: COMMUNITY_A,
      }),
    ).resolves.toBe(false);
  });

  it("deduplica antes de comparar", async () => {
    // Mandar el mismo colegio dos veces no debería hacer fallar la validación.
    const client = makeClient([{ count: "1" }]);
    await expect(
      areSchoolsInCommunity({
        client,
        schoolIds: [schoolA, schoolA],
        communityId: COMMUNITY_A,
      }),
    ).resolves.toBe(true);
    expect(client.query).toHaveBeenCalledWith(queries.countSchoolsInCommunity, [
      [schoolA],
      COMMUNITY_A,
    ]);
  });

  it("rechaza una lista vacía sin consultar la base", async () => {
    const client = makeClient([]);
    await expect(
      areSchoolsInCommunity({ client, schoolIds: [], communityId: COMMUNITY_A }),
    ).resolves.toBe(false);
    expect(client.query).not.toHaveBeenCalled();
  });
});
