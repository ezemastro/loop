/**
 * Tests del modelo de autenticación.
 *
 * Sobre el mock de la base: acá se usa el `postgresClient` **real** y se sustituye únicamente el
 * método `connect` de la instancia `dbConnection`. Esa es la única forma de que la sustitución
 * tenga efecto: `withClient` resuelve `dbConnection.connect` sobre ese objeto en cada llamada, pero
 * la referencia a `dbConnection` la cierra sobre el binding de su propio módulo. Un
 * `jest.mock("../services/postgresClient")` que devuelva un `dbConnection` falso y traiga el
 * `withClient` real con `requireActual` no intercepta nada: el `withClient` real sigue conectando
 * contra la instancia real. Con `jest.spyOn` sobre la instancia, en cambio, el orden de
 * operaciones, el manejo de la transacción y el mapeo de errores siguen siendo los de producción.
 */

// `pg` se mockea sólo para que importar el módulo real no construya pools de verdad; nunca se
// llega a usar, porque `connect` está intervenido.
jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

jest.mock("../services/hash", () => ({
  hashPassword: jest.fn(async () => "hashedPassword"),
  comparePasswords: jest.fn(
    async (input: string, stored: string | null) =>
      input === "validPassword" && stored === "hashedPassword",
  ),
}));

jest.mock("../services/email", () => ({
  sendVerificationEmail: jest.fn(async () => undefined),
  sendPasswordResetEmail: jest.fn(async () => undefined),
}));

import crypto from "crypto";
import { ERROR_MESSAGES } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  UnauthorizedError,
} from "../services/errors";
import { comparePasswords } from "../services/hash";
import { sendVerificationEmail } from "../services/email";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import { validatePrivateUser } from "../services/validations";
import { createMockClient, databaseQueryMock, MOCK_USER, MOCK_USER_DB } from "../tests/utils";
import type { NamedQuery } from "../types/dbClient";
import { AuthModel } from "./auth";

const mockQuery = jest.fn();
const connectMock = jest.spyOn(dbConnection, "connect");
const compareMock = jest.mocked(comparePasswords);
const sendVerificationEmailMock = jest.mocked(sendVerificationEmail);

/** Mismo digest que guarda `models/auth.ts` (SEC-10): la base nunca ve el token en claro. */
const sha256 = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

/** Parámetros de la primera llamada a una query concreta. */
const paramsOf = (key: string): unknown[] | undefined => {
  const call = mockQuery.mock.calls.find(
    ([query]: [NamedQuery<unknown>, unknown[]?]) => query.key === key,
  );
  return call?.[1];
};

/** Corre un login que debe fallar y devuelve el error, para poder compararlos entre sí. */
const loginFailure = async (email: string, password: string): Promise<unknown> => {
  try {
    await AuthModel.loginUser({ email, password });
  } catch (err) {
    return err;
  }
  throw new Error("loginUser debía fallar y no falló");
};

/** Error de `pg` por violación de índice único, con el shape que trae el driver. */
const uniqueViolation = (constraint: string): Error =>
  Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint,
  });

describe("AuthModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockImplementation(databaseQueryMock);
    connectMock.mockResolvedValue(createMockClient(mockQuery));
  });

  describe("Register", () => {
    it("Should register a user successfully", async () => {
      const modelReturn = await AuthModel.registerUser(MOCK_USER);
      await expect(validatePrivateUser(modelReturn.user)).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalled();
    });

    it("Should throw an error if user already exists", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userExists.key) {
          return [{ user_exists: true }];
        }
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS),
      );
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    /**
     * El pre-chequeo `userExists` es TOCTOU por naturaleza: dos registros concurrentes con el mismo
     * email lo pasan los dos. El índice único `idx_users_email_lower_uq` es la barrera real, y su
     * `23505` tiene que llegar al cliente como el mismo 409 que da el pre-chequeo (SEC-05), no como
     * un 500.
     */
    it("Should map the unique-email violation to the same conflict as the pre-check", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.insertUser.key) {
          throw uniqueViolation("idx_users_email_lower_uq");
        }
        return databaseQueryMock(query, params);
      });
      await expect(AuthModel.registerUser(MOCK_USER)).rejects.toThrow(
        new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS),
      );
    });

    /** Un choque de `google_id` es otro conflicto: reportarlo como "el email ya existe" mentiría. */
    it("Should not disguise a google_id collision as a duplicated email", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.insertUser.key) {
          throw uniqueViolation("users_google_id_key");
        }
        return databaseQueryMock(query, params);
      });
      await expect(AuthModel.registerUser(MOCK_USER)).rejects.toThrow(
        "duplicate key value violates unique constraint",
      );
    });

    it("Should throw an error if the email domain does not belong to any community", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.communityByDomain.key) return [];
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED),
      );
    });

    it("Should throw an error if the schools are not in the community", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.countSchoolsInCommunity.key) return [{ count: "0" }];
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.SCHOOLS_NOT_IN_COMMUNITY),
      );
    });

    it("Should throw an error if database is down", async () => {
      connectMock.mockRejectedValue(new Error("Database error"));
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR),
      );
    });
  });

  describe("Login", () => {
    it("Should return user if successful", async () => {
      const modelReturn = await AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(validatePrivateUser(modelReturn.user)).resolves.not.toThrow();
    });

    /**
     * Propiedad de seguridad (SEC-03 / D5), no un detalle de implementación: el login responde
     * **exactamente lo mismo** —mismo tipo de error, o sea mismo status; mismo mensaje y mismo
     * código, o sea mismo body— para un email inexistente, una password incorrecta y una cuenta
     * creada por Google que no tiene password local. Si alguno de los tres se pudiera distinguir,
     * el endpoint sería un oráculo de qué direcciones están registradas.
     *
     * Antes este test afirmaba lo contrario (esperaba `USER_NOT_FOUND` para el email inexistente),
     * que es justamente el oráculo que la remediación cerró.
     */
    it("Should fail identically for unknown email, wrong password and passwordless account", async () => {
      // A — la cuenta no existe.
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userByEmail.key) return [];
        return databaseQueryMock(query, params);
      });
      const unknownEmail = await loginFailure("nobody@example.com", "validPassword");
      // El bcrypt corre igual, contra un hash señuelo: sin eso el tiempo de respuesta seguiría
      // delatando qué direcciones existen, aunque el body ya fuera uniforme.
      expect(compareMock).toHaveBeenCalledTimes(1);

      // B — la cuenta existe, la password no coincide.
      mockQuery.mockImplementation(databaseQueryMock);
      const wrongPassword = await loginFailure(MOCK_USER.email, "invalidPassword");

      // C — cuenta creada por Google: existe, pero no tiene password local (SEC-16).
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userByEmail.key) return [{ ...MOCK_USER_DB, password: null }];
        return databaseQueryMock(query, params);
      });
      const noLocalPassword = await loginFailure(MOCK_USER.email, "validPassword");

      for (const err of [unknownEmail, wrongPassword, noLocalPassword]) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect(err).toMatchObject({
          message: ERROR_MESSAGES.INVALID_CREDENTIALS,
          code: "INVALID_CREDENTIALS",
        });
      }
    });

    /**
     * El login sí valida el dominio (antes era un TODO): si el correo dejó de pertenecer a la
     * comunidad del usuario y no entró por invitación, no puede seguir entrando.
     */
    it("Should throw error if the email no longer belongs to the community", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.communityByDomain.key) return [];
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new UnauthorizedError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED),
      );
    });

    /** El usuario invitado está exento de la regla de dominio: para eso existe `domain_exempt`. */
    it("Should let an invited user log in even if its domain is not in the community", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userByEmail.key) {
          return [{ ...MOCK_USER_DB, domain_exempt: true }];
        }
        if (query.key === queries.communityByDomain.key) return [];
        return databaseQueryMock(query, params);
      });
      const modelReturn = await AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(validatePrivateUser(modelReturn.user)).resolves.not.toThrow();
    });

    /** La cuenta recién registrada no puede entrar hasta verificar el mail. */
    it("Should reject login if the email is not verified", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userByEmail.key) {
          return [{ ...MOCK_USER_DB, email_verified: false }];
        }
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new UnauthorizedError(ERROR_MESSAGES.EMAIL_NOT_VERIFIED),
      );
    });

    /**
     * El orden importa y es deliberado: `EMAIL_NOT_VERIFIED` sólo se revela **después** de validar
     * la password. Quien no la tiene sigue viendo `INVALID_CREDENTIALS`, así que la respuesta no
     * delata que la dirección está registrada.
     */
    it("Should not reveal that an unverified account exists to someone without its password", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userByEmail.key) {
          return [{ ...MOCK_USER_DB, email_verified: false }];
        }
        return databaseQueryMock(query, params);
      });
      const err = await loginFailure(MOCK_USER.email, "invalidPassword");
      expect(err).toMatchObject({
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
        code: "INVALID_CREDENTIALS",
      });
    });

    it("Should throw error if database is down", async () => {
      connectMock.mockRejectedValue(new Error("Database error"));
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR),
      );
    });

    it("Should handle if is thrown an unexpected error", async () => {
      mockQuery.mockImplementationOnce(() => {
        throw new Error("Unexpected error");
      });
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow();
    });
  });

  describe("Email verification", () => {
    it("Should verify the email with a valid token", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.verifyUserEmail.key) return [{ id: MOCK_USER.id }];
        return databaseQueryMock(query, params);
      });
      const result = await AuthModel.verifyEmail("valid-token");
      expect(result).toEqual({ verified: true });
    });

    /**
     * SEC-10: la fila se busca por el digest del token, no por el token. El cleartext sólo existe
     * en el link del mail; si la base lo guardara tal cual, un dump de `users` sería un set de
     * llaves de toma de cuenta.
     */
    it("Should look the token up by its SHA-256 digest, never in cleartext", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.verifyUserEmail.key) return [{ id: MOCK_USER.id }];
        return databaseQueryMock(query, params);
      });
      await AuthModel.verifyEmail("valid-token");

      expect(paramsOf(queries.verifyUserEmail.key)).toEqual([sha256("valid-token")]);
      expect(paramsOf(queries.verifyUserEmail.key)).not.toContain("valid-token");
    });

    it("Should throw if the verification token is invalid", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.verifyUserEmail.key) return [];
        return databaseQueryMock(query, params);
      });
      await expect(AuthModel.verifyEmail("bad-token")).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.EMAIL_VERIFICATION_TOKEN_INVALID),
      );
    });

    it("Should resend the verification email for an unverified user", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userEmailVerifiedAndTokenByEmail.key) {
          return [{ id: MOCK_USER.id, email_verified: false }];
        }
        return databaseQueryMock(query, params);
      });
      const result = await AuthModel.resendVerificationEmail({ email: MOCK_USER.email });
      expect(result).toEqual({ sent: true });
    });

    /** El reenvío rota el token, y de la rotación la base sólo se entera del digest (SEC-10). */
    it("Should mail the cleartext token but persist only its digest", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userEmailVerifiedAndTokenByEmail.key) {
          return [{ id: MOCK_USER.id, email_verified: false }];
        }
        return databaseQueryMock(query, params);
      });
      await AuthModel.resendVerificationEmail({ email: MOCK_USER.email });

      const [storedHash, userId] = paramsOf(queries.updateUserVerificationToken.key) ?? [];
      const mailed = sendVerificationEmailMock.mock.calls[0]?.[0];

      expect(userId).toBe(MOCK_USER.id);
      expect(mailed?.to).toBe(MOCK_USER.email);
      expect(mailed?.token).toBeTruthy();
      expect(storedHash).toBe(sha256(String(mailed?.token)));
      expect(storedHash).not.toBe(mailed?.token);
    });

    /** La respuesta no distingue cuentas inexistentes de cuentas ya verificadas (anti-enumeración). */
    it("Should not reveal whether an email exists in resend", async () => {
      mockQuery.mockImplementation(async (query: NamedQuery<unknown>, params: unknown[] = []) => {
        if (query.key === queries.userEmailVerifiedAndTokenByEmail.key) return [];
        return databaseQueryMock(query, params);
      });
      const result = await AuthModel.resendVerificationEmail({ email: "nobody@northfield.edu.ar" });
      expect(result).toEqual({ sent: false });
      expect(sendVerificationEmailMock).not.toHaveBeenCalled();
    });
  });
});
