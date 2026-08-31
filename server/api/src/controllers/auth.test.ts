const registerUserMock = jest.fn();
const loginUserMock = jest.fn();
const verifyEmailMock = jest.fn();
const resendVerificationEmailMock = jest.fn();
jest.mock("../models/auth", () => ({
  AuthModel: {
    registerUser: registerUserMock,
    loginUser: loginUserMock,
    verifyEmail: verifyEmailMock,
    resendVerificationEmail: resendVerificationEmailMock,
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
    it("should register a user without auto-login (no token, no cookie)", async () => {
      const reqMock = getMockReq({
        body: { ...MOCK_USER },
      });
      await AuthController.register(reqMock, resMock, nextMock);
      expect(registerUserMock).toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(201);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ data: { message: expect.any(String) } }),
      );
      expect(resMock.cookie).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    });
    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({
        body: {},
      });
      await AuthController.register(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
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
      expect(resMock.json).toHaveBeenCalledWith(successResponse({ data: { user: MOCK_USER } }));
      expect(resMock.cookie).toHaveBeenCalledTimes(1);
      expect(generateTokenSpy).toHaveBeenCalledWith({ userId: MOCK_USER.id });
    });
    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({
        body: {},
      });
      await AuthController.login(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      expect(loginUserMock).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
    });
  });

  describe("verifyEmail", () => {
    it("should answer HTML success when the token is valid", async () => {
      verifyEmailMock.mockResolvedValue({ verified: true });
      const reqMock = getMockReq({ query: { token: "valid-token" } });
      await AuthController.verifyEmail(reqMock, resMock, nextMock);
      expect(verifyEmailMock).toHaveBeenCalledWith("valid-token");
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.send).toHaveBeenCalledWith(expect.stringContaining("Email verificado"));
    });

    it("should answer HTML error when the token is invalid", async () => {
      verifyEmailMock.mockRejectedValue(new Error("invalid"));
      const reqMock = getMockReq({ query: { token: "bad-token" } });
      await AuthController.verifyEmail(reqMock, resMock, nextMock);
      expect(resMock.status).toHaveBeenCalledWith(400);
      expect(resMock.send).toHaveBeenCalledWith(expect.stringContaining("Link inv&aacute;lido"));
    });

    it("should answer HTML error when the token is missing", async () => {
      const reqMock = getMockReq({ query: {} });
      await AuthController.verifyEmail(reqMock, resMock, nextMock);
      expect(verifyEmailMock).not.toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(400);
    });
  });

  describe("resendVerification", () => {
    it("should resend the verification email", async () => {
      resendVerificationEmailMock.mockResolvedValue({ sent: true });
      const reqMock = getMockReq({ body: { email: MOCK_USER.email } });
      await AuthController.resendVerification(reqMock, resMock, nextMock);
      expect(resendVerificationEmailMock).toHaveBeenCalledWith({ email: MOCK_USER.email });
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ data: { message: ERROR_MESSAGES.EMAIL_VERIFICATION_SENT } }),
      );
    });

    it("should throw if req body is invalid", async () => {
      const reqMock = getMockReq({ body: {} });
      await AuthController.resendVerification(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT));
      expect(resendVerificationEmailMock).not.toHaveBeenCalled();
    });
  });
});
