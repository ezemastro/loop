import supertest from "supertest";
import { app, server } from "../app";
import { MOCK_USER } from "./utils";

const api = supertest(app);

describe("Auth tests", () => {
  test("Register a new user", async () => {
    await api.post("/auth/register").send({
      email: MOCK_USER.email,
      password: MOCK_USER.password,
      firstName: MOCK_USER.firstName,
      lastName: MOCK_USER.lastName,
      roleId: MOCK_USER.roleId,
      schoolId: MOCK_USER.schoolId,
    } as PostAuthRegisterRequest["body"]);
    // Agregar GET de Role y de School para poder obtener los datos necesarios para el registro
  });
});

afterAll(() => {
  server.close();
});
