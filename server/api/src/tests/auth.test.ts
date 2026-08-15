import { MOCK_USER } from "./utils";

describe("Auth tests", () => {
  test("Register a new user", async () => {
    await global.api.post("/auth/register").send({
      email: MOCK_USER.email,
      password: MOCK_USER.password,
      firstName: MOCK_USER.firstName,
      lastName: MOCK_USER.lastName,
      schoolIds: MOCK_USER.schoolIds,
    } as PostAuthRegisterRequest["body"]);
    // TODO: sembrar una comunidad con su dominio y un colegio antes de este test; hoy el registro
    // depende de que el dominio del correo resuelva a alguna comunidad de la base.
  });
});
