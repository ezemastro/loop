import { AuthModel } from "./auth";
import { queries } from "../services/queries";
import { validateUser } from "../services/validations";
import { randomUUID } from "node:crypto";
import type {
  DatabaseClient,
  DatabaseConnection,
  NamedQuery,
} from "../types/dbClient";
import { ERROR_MESSAGES, INITIAL_CREDITS } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
} from "../services/errors";

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

const MOCK_SCHOOL: School = {
  id: randomUUID(),
  name: "Test School",
  mediaId: randomUUID(),
};
const MOCK_ROLE: Role = {
  id: randomUUID(),
  name: "Test Role",
};
const MOCK_USER: User & { password: string } = {
  id: randomUUID(),
  email: "test@example.com",
  firstName: "firstName",
  lastName: "lastName",
  schoolId: MOCK_SCHOOL.id,
  roleId: MOCK_ROLE.id,
  password: "validPassword",
  credits: {
    balance: INITIAL_CREDITS,
    locked: 0,
  },
  phone: null,
  profileMediaId: null,
  profileMedia: null,
};
const MOCK_USER_DB: DB_Users = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  first_name: MOCK_USER.firstName,
  last_name: MOCK_USER.lastName,
  school_id: MOCK_USER.schoolId,
  role_id: MOCK_USER.roleId,
  password: "hashedPassword",
  created_at: new Date().toISOString(),
  credits_balance: INITIAL_CREDITS,
  credits_locked: 0,
  phone: null,
  profile_media_id: null,
  updated_at: null,
};
const MOCK_SCHOOL_DB: DB_Schools = {
  id: MOCK_SCHOOL.id,
  name: MOCK_SCHOOL.name,
  media_id: MOCK_SCHOOL.mediaId,
  meta: null,
};
const MOCK_ROLE_DB: DB_Roles = {
  id: MOCK_ROLE.id,
  name: MOCK_ROLE.name,
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
      await expect(validateUser(modelReturn.user)).resolves.not.toThrow();
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
      await expect(validateUser(modelReturn.user)).resolves.not.toThrow();
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
