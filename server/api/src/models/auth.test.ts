const mockQuery = jest.fn();
const mockConnect = jest.fn();

jest.mock("../services/postgresClient", () => ({
  dbConnection: {
    connect: mockConnect,
  },
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
} from "../services/errors";
import { databaseQueryMock, MOCK_USER, MOCK_USER_DB } from "../tests/utils";

describe("AuthModel", () => {
  beforeEach(() => {
    mockQuery.mockImplementation(databaseQueryMock);
    mockConnect.mockResolvedValue({
      query: mockQuery,
      begin: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    });
    jest.clearAllMocks();
  });

  describe("Register", () => {
    it.skip("Should register a user successfully", async () => {
      const modelReturn = await AuthModel.registerUser(MOCK_USER);
      await expect(
        validatePrivateUser(modelReturn.user),
      ).resolves.not.toThrow();
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

    it("Should throw an error if school does not exist", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.schoolById) {
          return [];
        }
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.SCHOOL_NOT_FOUND),
      );
      expect(mockQuery).toHaveBeenCalled();
    });

    it("Should throw an error if role does not exist", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.roleById) {
          return [];
        }
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.registerUser(MOCK_USER);
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.ROLE_NOT_FOUND),
      );
      expect(mockQuery).toHaveBeenCalled();
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
      await expect(
        validatePrivateUser(modelReturn.user),
      ).resolves.not.toThrow();
    });

    it("Should throw error if password is incorrect", async () => {
      mockQuery.mockImplementation(async (query, params) => {
        if (query === queries.userByEmail) {
          return [MOCK_USER_DB];
        }
        return databaseQueryMock(query, params);
      });
      const modelReturn = AuthModel.loginUser({
        email: MOCK_USER.email,
        password: "invalidPassword",
      });
      await expect(modelReturn).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS),
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
        new InvalidInputError(ERROR_MESSAGES.INVALID_CREDENTIALS),
      );
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
