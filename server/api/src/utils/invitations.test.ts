import { ConflictError, InvalidInputError } from "../services/errors";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { consumeInvitation, lockInvitation } from "./invitations";

/**
 * Invitaciones de un solo uso.
 *
 * La garantía de "un solo uso" se apoya en el `FOR UPDATE` de `invitationByTokenForUpdate`, que no
 * se puede probar sin una base real (hace falta concurrencia). Lo que sí se prueba acá es el resto:
 * que cada estado inválido de la invitación se rechace con el error correcto, y que el chequeo
 * redundante de `consumeInvitation` funcione si alguien se adelantó.
 */

const COMMUNITY = "22222222-2222-4222-8222-222222222222";
const INVITATION_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

const baseInvitation: DB_Invitations = {
  id: INVITATION_ID,
  token: "un-token",
  community_id: COMMUNITY,
  created_by_admin_id: "55555555-5555-4555-8555-555555555555",
  used_by_user_id: null,
  used_at: null,
  expires_at: null,
  note: null,
  created_at: new Date().toISOString(),
};

/** Cliente mínimo: `lockInvitation` solo consulta, no necesita transacción real. */
const makeClient = (rows: unknown[]) =>
  ({
    query: jest.fn(async () => rows),
    begin: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    scope: { mode: "community", communityId: COMMUNITY },
    communityId: COMMUNITY,
  }) as unknown as DatabaseClient;

describe("lockInvitation", () => {
  it("devuelve null si no se pasó token: es el camino normal de registro", async () => {
    const client = makeClient([]);
    await expect(lockInvitation({ client, token: undefined })).resolves.toBeNull();
    expect(client.query).not.toHaveBeenCalled();
  });

  it("bloquea la fila con FOR UPDATE", async () => {
    const client = makeClient([baseInvitation]);
    await lockInvitation({ client, token: "un-token" });
    expect(client.query).toHaveBeenCalledWith(queries.invitationByTokenForUpdate, ["un-token"]);
    expect(queries.invitationByTokenForUpdate.text).toContain("FOR UPDATE");
  });

  it("rechaza un token que no existe", async () => {
    await expect(
      lockInvitation({ client: makeClient([]), token: "inexistente" }),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });

  it("rechaza una invitación ya usada", async () => {
    const usada = {
      ...baseInvitation,
      used_by_user_id: USER_ID,
      used_at: new Date().toISOString(),
    };
    await expect(
      lockInvitation({ client: makeClient([usada]), token: "un-token" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rechaza una invitación vencida", async () => {
    const vencida = {
      ...baseInvitation,
      expires_at: new Date(Date.now() - 86_400_000).toISOString(),
    };
    await expect(
      lockInvitation({ client: makeClient([vencida]), token: "un-token" }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("acepta una invitación cuyo vencimiento todavía no llegó", async () => {
    const vigente = {
      ...baseInvitation,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    };
    await expect(
      lockInvitation({ client: makeClient([vigente]), token: "un-token" }),
    ).resolves.toMatchObject({ id: INVITATION_ID });
  });
});

describe("consumeInvitation", () => {
  it("la marca como usada", async () => {
    const client = makeClient([{ id: INVITATION_ID }]);
    await expect(
      consumeInvitation({ client, invitationId: INVITATION_ID, userId: USER_ID }),
    ).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledWith(queries.consumeInvitation, [USER_ID, INVITATION_ID]);
  });

  it("falla si el UPDATE no afectó ninguna fila", async () => {
    // El `AND used_by_user_id IS NULL` de la query es el cinturón de seguridad del FOR UPDATE:
    // si no devolvió filas, alguien la consumió en el medio.
    await expect(
      consumeInvitation({
        client: makeClient([]),
        invitationId: INVITATION_ID,
        userId: USER_ID,
      }),
    ).rejects.toMatchObject({ code: "INVITATION_ALREADY_USED" });
  });

  it("la query solo toca invitaciones sin usar", async () => {
    expect(queries.consumeInvitation.text).toContain("used_by_user_id IS NULL");
  });
});
