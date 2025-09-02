describe("Schools API", () => {
  it("should return a list of schools", async () => {
    const response = await global.api.get("/schools");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("schools");
    expect(response.body.data.schools.length).toBeGreaterThan(1);
    expect(response.body).toHaveProperty("pagination");
  });
  it("should return a single school by id for each school", async () => {
    const schoolsResponse = await global.api.get("/schools");
    for (const school of schoolsResponse.body.data.schools) {
      const response = await global.api.get(`/schools/${school.id}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("school");
      expect(response.body.data.school).toEqual(school);
    }
  });
});
