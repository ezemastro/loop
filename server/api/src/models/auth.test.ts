const mockQuery = jest.fn();
const mockConnect = jest.fn();

jest.mock("../services/postgresClient", () => ({
  dbConnection: {
    connect: mockConnect,
  },
  // `withClient` es el real: lo que se mockea es la conexión, para que el orden de llamadas y el
  // manejo de la transacción sigan siendo los de producción.
  withClient: jest.requireActual("../services/postgresClient").withClient,
  inCommunity: jest.requireActual("../services/postgresClient").inCommunity,
  unscoped: jest.requireActual("../services/postgresClient").unscoped,
}));

jest.mock("../services/hash", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashedPassword"),
  comparePasswords: jest.fn((input, stored) =>
    Promise.resolve(input === "validPassword" && stored === "hashedPassword"),
  ),
}));

import { AuthModel } from "./auth";
import { queries } from "../services/queries";
import { validatePrivateUser } from "../services/validations";
import { ERROR_MESSAGES } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  UnauthorizedError,
} from "../services/errors";
import { createMockClient, databaseQueryMock, MOCK_USER, MOCK_USER_DB } from "../tests/utils";

describe("AuthModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockImplementation(databaseQueryMock);
    mockConnect.mockResolvedValue(createMockClient(mockQuery));
  });

  describe("Register", () => {
    it("Should register a user successfully", async () => {
      const modelReturn = await AuthModel.registerUser(MOCK_USER);
      await expect(validatePrivateUser(modelReturn.user)).resolves.not.toThrow();
      expect(mockQuery).toHaveBeenCalled();
    });

    it("Should throw an error if user already exists", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.userExists) {
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

    it("Should throw an error if the email domain does not belong to any community", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.communityByDomain) return [];
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.EMAIL_NOT_AUTHORIZED),
      );
    });

    it("Should throw an error if the schools are not in the community", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.countSchoolsInCommunity) return [{ count: "0" }];
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.SCHOOLS_NOT_IN_COMMUNITY),
      );
    });

    it("Should throw an error if database is down", async () => {
      mockConnect.mockRejectedValue(new Error("Database error"));
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

    it("Should throw error if password is incorrect", async () => {
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "invalidPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS),
      );
    });

    it("Should throw error if user does not exist", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.userByEmail) {
          return [];
        }
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND),
      );
    });

    /**
     * El login sí valida el dominio (antes era un TODO): si el correo dejó de pertenecer a la
     * comunidad del usuario y no entró por invitación, no puede seguir entrando.
     */
    it("Should throw error if the email no longer belongs to the community", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.communityByDomain) return [];
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
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.userByEmail) return [{ ...MOCK_USER_DB, domain_exempt: true }];
        if (query === queries.communityByDomain) return [];
        return databaseQueryMock(query, params);
      });
      const modelReturn = await AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(validatePrivateUser(modelReturn.user)).resolves.not.toThrow();
    });

    it("Should throw error if database is down", async () => {
      mockConnect.mockRejectedValue(new Error("Database error"));
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
});
