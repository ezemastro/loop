import supertest from "supertest";
import { app, server } from "../app";

const api = supertest(app);

describe("Roles API", () => {
  it("should return a list of roles", async () => {
    const response = await api.get("/roles");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("roles");
    expect(response.body.roles.length).toBeGreaterThan(1);
    expect(response.body).toHaveProperty("pagination");
  });
});

afterAll(() => {
  server.close();
});
