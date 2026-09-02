jest.mock("../services/postgresClient", () => {
  // Se piden con `requireActual` en vez de `import` porque una `jest.mock` factory solo puede
  // referenciar, sin prefijo `mock`, variables resueltas dentro de su propio cuerpo.
  const { InternalServerError } = jest.requireActual("../services/errors");
  const { ERROR_MESSAGES } = jest.requireActual("../config");

  const dbConnection = {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  };

  // Reimplementa el contrato mínimo de `withClient` real (postgresClient.ts): conecta, corre
  // `fn(client)` y libera. `inCommunity`/`withClient` no forman parte del mock original, y como
  // `jest.mock` reemplaza el módulo entero, quedaban `undefined` — cada call site fallaba con
  // `TypeError: withClient is not a function` en vez del error de negocio que el test buscaba.
  const withClient = jest.fn(
    async (fn: (client: unknown) => unknown, options: { scope: unknown }) => {
      let client;
      try {
        client = await dbConnection.connect(options.scope);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }
      try {
        return await fn(client);
      } finally {
        await client.release();
      }
    },
  );

  const inCommunity = (communityId: string) => ({ mode: "community", communityId });

  return { dbConnection, withClient, inCommunity };
});
import { InternalServerError } from "../services/errors";
import { ERROR_MESSAGES } from "../config";
import { dbConnection } from "../services/postgresClient";
import { validatePrivateUser } from "../services/validations";
import { queries } from "../services/queries";
import { databaseQueryMock, MOCK_RANDOM_MEDIA, MOCK_USER } from "../tests/utils";
import { SelfModel } from "./self";

// Orden real en `models/self.ts` (`updateSelf`): [email, firstName, lastName, phone, profileMediaId, password, userId, communityId]
const UPDATE_USER_ARG_INDEX = { firstName: 1, lastName: 2, phone: 3, profileMediaId: 4 } as const;

describe("SelfModel", () => {
  let mockConnection: { query: jest.Mock; release: jest.Mock };
  /**
   * `mockConnection.query` es estático (siempre responde lo mismo para `userById`), así que el
   * re-fetch final de `updateSelf` (`getPrivateUserById`) nunca refleja lo que la llamada previa a
   * `queries.updateUser` efectivamente mandó a escribir. Estos tests verifican los argumentos de
   * esa llamada en vez del usuario re-leído, que con este mock no puede probar un round-trip real.
   */
  const updateUserCallArgs = () =>
    mockConnection.query.mock.calls.find(
      ([query]: [{ key: string }]) => query.key === queries.updateUser.key,
    )?.[1] as unknown[] | undefined;
  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (dbConnection.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockConnection.query.mockImplementation(databaseQueryMock);
  });

  describe("getSelf", () => {
    it("Should return user data", async () => {
      const result = await SelfModel.getSelf({
        userId: MOCK_USER.id,
        communityId: MOCK_USER.communityId,
      });
      await expect(validatePrivateUser(result.user)).resolves.not.toThrow();
    });
    it("Should handle database error", async () => {
      dbConnection.connect = jest.fn().mockRejectedValue(new Error("DB Error"));
      await expect(
        SelfModel.getSelf({ userId: MOCK_USER.id, communityId: MOCK_USER.communityId }),
      ).rejects.toThrow(new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR));
    });
  });

  describe("updateSelf", () => {
    it("Should update user data if all parameters are valid", async () => {
      await SelfModel.updateSelf({
        ...MOCK_USER,
        userId: MOCK_USER.id,
      });
      const args = updateUserCallArgs();
      expect(args?.[UPDATE_USER_ARG_INDEX.firstName]).toBe(MOCK_USER.firstName);
      expect(args?.[UPDATE_USER_ARG_INDEX.lastName]).toBe(MOCK_USER.lastName);
      expect(args?.[UPDATE_USER_ARG_INDEX.phone]).toBe(MOCK_USER.phone);
    });
    // `email` no participa: `updateSelf` siempre conserva el email ya existente (self.ts:122-125),
    // así que no hay un caso "válido" de email que probar aquí.
    it.each([
      { field: "phone", value: "+1234567890" },
      { field: "firstName", value: "ValidFirstName" },
      { field: "lastName", value: "ValidLastName" },
      { field: "profileMediaId", value: MOCK_RANDOM_MEDIA.id },
    ])("Should update user data if $field is valid", async ({ field, value }) => {
      await SelfModel.updateSelf({
        ...MOCK_USER,
        userId: MOCK_USER.id,
        [field]: value,
      });
      const args = updateUserCallArgs();
      expect(args?.[UPDATE_USER_ARG_INDEX[field as keyof typeof UPDATE_USER_ARG_INDEX]]).toBe(
        value,
      );
    });
    it.each([
      { field: "email", value: "invalid-email" },
      { field: "phone", value: "inv" },
      { field: "firstName", value: "i" },
      { field: "lastName", value: "i" },
      { field: "profileMediaId", value: "inv" },
    ])("Should not update user data if $field is invalid", async ({ field, value }) => {
      const result = await SelfModel.updateSelf({
        ...MOCK_USER,
        userId: MOCK_USER.id,
        [field]: value,
      });
      expect(result.user[field as keyof typeof result.user]).toBe(
        MOCK_USER[field as keyof typeof MOCK_USER],
      );
    });
    it("Should update if many data is invalid", async () => {
      const result = await SelfModel.updateSelf({
        ...MOCK_USER,
        userId: MOCK_USER.id,
        // `email` ya no es parte del payload: `PATCH /me` no puede cambiar el correo.
        phone: "inv",
        firstName: "i",
        lastName: "i",
        profileMediaId: "inv",
      });
      expect(result.user).toMatchObject({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        phone: MOCK_USER.phone,
        firstName: MOCK_USER.firstName,
        lastName: MOCK_USER.lastName,
        profileMediaId: MOCK_USER.profileMediaId,
      });
    });
    it("Should handle database error", async () => {
      dbConnection.connect = jest.fn().mockRejectedValue(new Error("DB Error"));
      await expect(
        SelfModel.updateSelf({ userId: MOCK_USER.id, communityId: MOCK_USER.communityId }),
      ).rejects.toThrow(new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR));
    });
  });
});
