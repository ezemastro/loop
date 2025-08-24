describe("Users API", () => {
  it("should return a list of users", async () => {
    const response = await global.api.get("/users");
    console.log(response.error);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("users");
    expect(response.body.users.length).toBeGreaterThan(1);
    expect(response.body).toHaveProperty("pagination");
  });
});
