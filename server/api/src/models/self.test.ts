jest.mock("../services/postgresClient", () => ({
  dbConnection: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  },
}));
import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { validatePrivateUser } from "../services/validations";
import { databaseQueryMock, MOCK_USER } from "../test/utils";
import { SelfModel } from "./self";

describe("SelfModel", () => {
  let mockConnection;
  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (dbConnection.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockConnection.query.mockImplementation(databaseQueryMock);
  });

  describe("getSelf", () => {
    it("Should return user data", async () => {
      const result = await SelfModel.getSelf({ userId: MOCK_USER.id });
      await expect(validatePrivateUser(result.user)).resolves.not.toThrow();
    });
    it("Should handle database error", async () => {
      dbConnection.connect = jest.fn().mockRejectedValue(new Error("DB Error"));
      await expect(SelfModel.getSelf({ userId: MOCK_USER.id })).rejects.toThrow(
        new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR),
      );
    });
  });
});
