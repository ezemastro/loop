const getSelfMock = jest.fn();
jest.mock("../models/self", () => ({
  SelfModel: {
    getSelf: getSelfMock,
  },
}));

import { getMockReq, getMockRes } from "@jest-mock/express";
import { SelfController } from "./self";
import { MOCK_USER } from "../tests/utils";
import type { Request } from "express";
import { validatePrivateUser } from "../services/validations";

const { res, next } = getMockRes();
let req: Request;
describe("SelfController", () => {
  beforeEach(() => {
    req = getMockReq({
      session: {
        userId: MOCK_USER.id,
      },
    });
    jest.clearAllMocks();
    getSelfMock.mockResolvedValue({ user: MOCK_USER });
  });
  describe("getSelf", () => {
    it("Should get the user information", async () => {
      await SelfController.getSelf(req, res, next);
      await expect(
        validatePrivateUser((res.json as jest.Mock).mock.calls[0][0].user),
      ).resolves.not.toThrow();
      expect(getSelfMock).toHaveBeenCalledWith({ userId: MOCK_USER.id });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
