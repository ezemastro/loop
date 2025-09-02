describe("Users API", () => {
  it("should return a list of users", async () => {
    const response = await global.api.get("/users");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("users");
    expect(response.body.data.users.length).toBeGreaterThan(1);
    expect(response.body).toHaveProperty("pagination");
  });
});
