const registerUserMock = jest.fn();
const loginUserMock = jest.fn();
jest.mock("../models/auth", () => ({
  AuthModel: {
    registerUser: registerUserMock,
    loginUser: loginUserMock,
  },
}));

import { ERROR_MESSAGES } from "../config";
import { InvalidInputError } from "../services/errors";
import * as jwt from "../services/jwt";
import { MOCK_USER } from "../tests/utils";
import { successResponse } from "../utils/responses";
import { AuthController } from "./auth";
import { getMockReq, getMockRes } from "@jest-mock/express";

const generateTokenSpy = jest.spyOn(jwt, "generateToken");

const { res: resMock, next: nextMock } = getMockRes();

describe("AuthController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registerUserMock.mockResolvedValue({
      user: MOCK_USER,
    });
    loginUserMock.mockResolvedValue({
      user: MOCK_USER,
    });
  });

  describe("register", () => {
    it("should register a user", async () => {
      const reqMock = getMockReq({
        body: { ...MOCK_USER },
      });
      await AuthController.register(reqMock, resMock, nextMock);
      expect(registerUserMock).toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(201);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ data: { user: MOCK_USER } }),
      );
      expect(resMock.cookie).toHaveBeenCalledTimes(1);
      expect(generateTokenSpy).toHaveBeenCalledWith({ userId: MOCK_USER.id });
    });
    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({
        body: {},
      });
      expect(
        AuthController.register(reqMock, resMock, nextMock),
      ).rejects.toThrow(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      expect(registerUserMock).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should log in a user", async () => {
      const reqMock = getMockReq({
        body: { email: MOCK_USER.email, password: "password123" },
      });
      await AuthController.login(reqMock, resMock, nextMock);
      expect(loginUserMock).toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ data: { user: MOCK_USER } }),
      );
      expect(resMock.cookie).toHaveBeenCalledTimes(1);
      expect(generateTokenSpy).toHaveBeenCalledWith({ userId: MOCK_USER.id });
    });
    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({
        body: {},
      });
      expect(AuthController.login(reqMock, resMock, nextMock)).rejects.toThrow(
        new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT),
      );
      expect(loginUserMock).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    });
  });
});
