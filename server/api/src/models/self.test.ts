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
import {
  databaseQueryMock,
  MOCK_RANDOM_MEDIA,
  MOCK_USER,
} from "../tests/utils";
import { SelfModel } from "./self";

console.log(jest.isMockFunction(dbConnection.connect));

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

  describe("updateSelf", () => {
    it.skip("Should update user data if all parameters are valid", async () => {
      const result = await SelfModel.updateSelf({
        ...MOCK_USER,
        userId: MOCK_USER.id,
      });
      expect(MOCK_USER).toMatchObject(result.user);
    });
    it.skip.each([
      { field: "email", value: "valid@email.com" },
      { field: "phone", value: "+1234567890" },
      { field: "firstName", value: "ValidFirstName" },
      { field: "lastName", value: "ValidLastName" },
      { field: "profileMediaId", value: MOCK_RANDOM_MEDIA.id },
    ])(
      "Should update user data if $field is valid",
      async ({ field, value }) => {
        const result = await SelfModel.updateSelf({
          ...MOCK_USER,
          userId: MOCK_USER.id,
          [field]: value,
        });
        expect(result.user[field as keyof typeof result.user]).toBe(value);
      },
    );
    it.skip.each([
      { field: "email", value: "invalid-email" },
      { field: "phone", value: "inv" },
      { field: "firstName", value: "i" },
      { field: "lastName", value: "i" },
      { field: "profileMediaId", value: "inv" },
    ])(
      "Should not update user data if $field is invalid",
      async ({ field, value }) => {
        const result = await SelfModel.updateSelf({
          ...MOCK_USER,
          userId: MOCK_USER.id,
          [field]: value,
        });
        expect(result.user[field as keyof typeof result.user]).toBe(
          MOCK_USER[field as keyof typeof MOCK_USER],
        );
      },
    );
    it.skip("Should update if many data is invalid", async () => {
      const result = await SelfModel.updateSelf({
        ...MOCK_USER,
        userId: MOCK_USER.id,
        email: "invalid-email",
        phone: "inv",
        firstName: "i",
        lastName: "i",
        profileMediaId: "inv",
      });
      expect(result.user).toMatchObject({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        phone: MOCK_USER.phone,
        firstName: MOCK_USER.firstName,
        lastName: MOCK_USER.lastName,
        profileMediaId: MOCK_USER.profileMediaId,
      });
    });
    it("Should handle database error", async () => {
      dbConnection.connect = jest.fn().mockRejectedValue(new Error("DB Error"));
      await expect(
        SelfModel.updateSelf({ userId: MOCK_USER.id }),
      ).rejects.toThrow(new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR));
    });
  });
});
