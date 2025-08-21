import { ERROR_MESSAGES } from "../config";
import { InvalidInputError } from "../services/errors";
import * as jwt from "../services/jwt";
import { MOCK_USER } from "../test/utils";
import type { AuthModel } from "../types/models";
import { successResponse } from "../utils/responses";
import { AuthController } from "./auth";
import { getMockReq, getMockRes } from "@jest-mock/express";

const generateTokenSpy = jest.spyOn(jwt, "generateToken");
const authModelMock: Partial<AuthModel> = {
  registerUser: jest.fn().mockResolvedValue({
    user: MOCK_USER,
  }),
  loginUser: jest.fn().mockResolvedValue({
    user: MOCK_USER,
  }),
};

const { res: resMock } = getMockRes();

describe("AuthController", () => {
  let authController: AuthController;
  beforeEach(() => {
    jest.clearAllMocks();
    authController = new AuthController({
      authModel: authModelMock as AuthModel,
    });
  });

  describe("register", () => {
    it("should register a user", async () => {
      const reqMock = getMockReq({
        body: { ...MOCK_USER },
      });
      await authController.register(reqMock, resMock);
      expect(authModelMock.registerUser).toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(201);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ user: MOCK_USER }),
      );
      expect(resMock.cookie).toHaveBeenCalledTimes(1);
      expect(generateTokenSpy).toHaveBeenCalledWith({ userId: MOCK_USER.id });
    });
    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({
        body: {},
      });
      expect(authController.register(reqMock, resMock)).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT),
      );
      expect(authModelMock.registerUser).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should log in a user", async () => {
      const reqMock = getMockReq({
        body: { email: MOCK_USER.email, password: "password123" },
      });
      await authController.login(reqMock, resMock);
      expect(authModelMock.loginUser).toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ user: MOCK_USER }),
      );
      expect(resMock.cookie).toHaveBeenCalledTimes(1);
      expect(generateTokenSpy).toHaveBeenCalledWith({ userId: MOCK_USER.id });
    });
    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({
        body: {},
      });
      expect(authController.login(reqMock, resMock)).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT),
      );
      expect(authModelMock.loginUser).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    });
  });
});
