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

import { COOKIE_NAMES, cookieOptions, ERROR_MESSAGES } from "../config";
import { InvalidInputError, UnauthorizedError } from "../services/errors";
import * as jwt from "../services/jwt";
import { MOCK_USER } from "../tests/utils";
import { successResponse } from "../utils/responses";
import { AuthController } from "./auth";
import { getMockReq, getMockRes } from "@jest-mock/express";

const generateTokenSpy = jest.spyOn(jwt, "generateToken");

const { res: resMock, next: nextMock } = getMockRes();

/** El token que el controller acabó de firmar, para comparar cookie y body contra el mismo valor. */
const signedToken = (): string | undefined => generateTokenSpy.mock.results[0]?.value;

describe("AuthController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registerUserMock.mockResolvedValue({
      user: MOCK_USER,
      requireEmailVerification: false,
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

    /**
     * El mensaje del 201 depende de si la cuenta nace verificada o no: con verificación exigida hay
     * un paso más antes de poder entrar, y el copy tiene que decirlo. Antes el mock del modelo no
     * devolvía `requireEmailVerification`, así que el controller siempre tomaba la rama de "ya
     * podés iniciar sesión" y esta bifurcación no estaba cubierta.
     */
    it.each([
      { requireEmailVerification: true, expected: "Revisá tu email" },
      { requireEmailVerification: false, expected: "Ya podés iniciar sesión" },
    ])(
      "should tell the user to verify the email only when it is required ($requireEmailVerification)",
      async ({ requireEmailVerification, expected }) => {
        registerUserMock.mockResolvedValue({ user: MOCK_USER, requireEmailVerification });
        const reqMock = getMockReq({ body: { ...MOCK_USER } });
        await AuthController.register(reqMock, resMock, nextMock);
        expect(resMock.json).toHaveBeenCalledWith(
          successResponse({ data: { message: expect.stringContaining(expected) } }),
        );
      },
    );

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
    /**
     * El token se firma con la comunidad adentro (`communityId`), no sólo con el `userId`: es lo que
     * deja que `tokenMiddleware` scopee cada request sin volver a la base. Y el mismo token viaja en
     * la cookie y en el body, para los clientes que no manejan cookies.
     */
    it("should log in a user, scoping the token to the community", async () => {
      const reqMock = getMockReq({
        body: { email: MOCK_USER.email, password: "password123" },
      });
      await AuthController.login(reqMock, resMock, nextMock);
      expect(loginUserMock).toHaveBeenCalled();
      expect(generateTokenSpy).toHaveBeenCalledWith({
        userId: MOCK_USER.id,
        communityId: MOCK_USER.communityId,
      });
      expect(signedToken()).toEqual(expect.any(String));
      expect(resMock.status).toHaveBeenCalledWith(200);
      expect(resMock.json).toHaveBeenCalledWith(
        successResponse({ data: { user: MOCK_USER, token: signedToken() } }),
      );
      expect(resMock.cookie).toHaveBeenCalledTimes(1);
      expect(resMock.cookie).toHaveBeenCalledWith(COOKIE_NAMES.TOKEN, signedToken(), cookieOptions);
    });

    /**
     * El login del modelo responde lo mismo para un email inexistente que para una password
     * incorrecta (SEC-03). El controller no puede deshacer esa uniformidad: reenvía el error tal
     * cual, sin agregar status ni cuerpo propios, y no emite cookie ni token.
     */
    it("should forward the model failure untouched, with no cookie and no token", async () => {
      const failure = new UnauthorizedError(
        ERROR_MESSAGES.INVALID_CREDENTIALS,
        "INVALID_CREDENTIALS",
      );
      loginUserMock.mockRejectedValue(failure);
      const reqMock = getMockReq({
        body: { email: MOCK_USER.email, password: "password123" },
      });
      await AuthController.login(reqMock, resMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(failure);
      expect(resMock.status).not.toHaveBeenCalled();
      expect(resMock.cookie).not.toHaveBeenCalled();
      expect(generateTokenSpy).not.toHaveBeenCalled();
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

    /**
     * La respuesta es la misma exista o no la cuenta: el modelo devuelve `{ sent: false }` sin
     * error, y el controller responde el mismo 200 con el mismo cuerpo que en el caso positivo.
     */
    it("should answer the same 200 when the address is not registered", async () => {
      resendVerificationEmailMock.mockResolvedValue({ sent: false });
      const reqMock = getMockReq({ body: { email: "nobody@example.com" } });
      await AuthController.resendVerification(reqMock, resMock, nextMock);
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
