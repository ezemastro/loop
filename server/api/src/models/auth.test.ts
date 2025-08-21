import { AuthModel } from "./auth";
import { queries } from "../services/queries";
import { validateProfile } from "../services/validations";
import type {
  DatabaseClient,
  DatabaseConnection,
  NamedQuery,
} from "../types/dbClient";
import { ERROR_MESSAGES } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
} from "../services/errors";
import {
  MOCK_ROLE_DB,
  MOCK_SCHOOL_DB,
  MOCK_USER,
  MOCK_USER_DB,
} from "../test/utils";

jest.mock("../services/hash", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashedPassword"),
  comparePasswords: jest.fn((input, stored) =>
    Promise.resolve(input === "validPassword" && stored === "hashedPassword"),
  ),
}));

const mockQuery = jest.fn();

const mockDbConnectionDefault: DatabaseConnection = {
  connect: jest.fn().mockResolvedValue({
    query: mockQuery,
    begin: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  } as DatabaseClient),
};
const mockQueryDefault = async (query: NamedQuery<unknown>) => {
  if (query === queries.userExists) {
    return [{ exists: false }];
  }
  if (query === queries.insertUser) {
    return [{ id: MOCK_USER.id }];
  }
  if (query === queries.schoolById) {
    return [MOCK_SCHOOL_DB];
  }
  if (query === queries.roleById) {
    return [MOCK_ROLE_DB];
  }
  if (query === queries.userByEmail) {
    return [MOCK_USER_DB];
  }
  if (query === queries.userById) {
    return [MOCK_USER_DB];
  }
  if (query === queries.mediaById) {
    return [
      MOCK_USER.profileMediaId
        ? {
            id: MOCK_USER.profileMediaId,
            url: "http://example.com/media.jpg",
            type: "image",
            mime: "image/jpeg",
          }
        : null,
    ];
  }
};

describe("AuthModel", () => {
  let authModel: AuthModel;
  let mockDbConnection: DatabaseConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDbConnection = { ...mockDbConnectionDefault };
    authModel = new AuthModel({ dbConnection: mockDbConnection, queries });
    mockQuery.mockImplementation(mockQueryDefault);
  });

  describe("Register", () => {
    test("Should register a user successfully", async () => {
      const modelReturn = await authModel.registerUser(MOCK_USER);
      // Devolver el usuario creado
      await expect(validateProfile(modelReturn.profile)).resolves.not.toThrow();
      // Haber verificado el usuario
      expect(mockQuery).toHaveBeenCalledWith(queries.userExists, [
        MOCK_USER.email,
        MOCK_USER.firstName,
        MOCK_USER.lastName,
      ]);
      // Haber insertado el usuario
      expect(mockQuery).toHaveBeenCalledWith(queries.insertUser, [
        MOCK_USER.email,
        MOCK_USER.firstName,
        MOCK_USER.lastName,
        "hashedPassword",
        MOCK_USER.schoolId,
        MOCK_USER.roleId,
      ]);
    });

    test("Should throw an error if user already exists", async () => {
      mockQuery.mockImplementation(async (query) => {
        if (query === queries.userExists) {
          return [{ exists: true }];
        }
        return mockQueryDefault(query);
      });
      const modelReturn = authModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new ConflictError(ERROR_MESSAGES.USER_ALREADY_EXISTS),
      );
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test("Should throw an error if school does not exist", async () => {
      mockQuery.mockImplementation(async (query) => {
        if (query === queries.schoolById) {
          return [];
        }
        return mockQueryDefault(query);
      });
      const modelReturn = authModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.SCHOOL_NOT_FOUND),
      );
      expect(mockQuery).toHaveBeenCalled();
    });

    test("Should throw an error if role does not exist", async () => {
      mockQuery.mockImplementation(async (query) => {
        if (query === queries.roleById) {
          return [];
        }
        return mockQueryDefault(query);
      });
      const modelReturn = authModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.ROLE_NOT_FOUND),
      );
      expect(mockQuery).toHaveBeenCalled();
    });

    test("Should throw an error if database is down", async () => {
      mockDbConnection.connect = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      const modelReturn = authModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InternalServerError("Error al conectar a la base de datos"),
      );
    });

    test("Should handle unexpected errors", async () => {
      mockQuery.mockImplementationOnce(() => {
        throw new Error("Unexpected error");
      });
      const modelReturn = authModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR),
      );
    });
  });

  describe("Login", () => {
    test("Should return user if successful", async () => {
      const modelReturn = await authModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(validateProfile(modelReturn.profile)).resolves.not.toThrow();
    });
    test("Should throw error if password is incorrect", async () => {
      mockQuery.mockImplementation(async (query) => {
        if (query === queries.userByEmail) {
          return [MOCK_USER_DB];
        }
        return mockQueryDefault(query);
      });
      const modelReturn = authModel.loginUser({
        email: MOCK_USER.email,
        password: "invalidPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS),
      );
    });
    test("Should throw error if user does not exist", async () => {
      mockQuery.mockImplementation(async (query) => {
        if (query === queries.userByEmail) {
          return [];
        }
        return mockQueryDefault(query);
      });
      const modelReturn = authModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS),
      );
    });
    test("Should throw error if database is down", async () => {
      mockDbConnection.connect = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));
      const modelReturn = authModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR),
      );
    });
    test("Should handle if is thrown an unexpected error", async () => {
      mockQuery.mockImplementationOnce(() => {
        throw new Error("Unexpected error");
      });
      const modelReturn = authModel.loginUser({
        email: MOCK_USER.email,
        password: "validPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new InternalServerError(ERROR_MESSAGES.UNEXPECTED_ERROR),
      );
    });
  });
});
