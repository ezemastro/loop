/**
 * Zod-level tests for the pagination and admin schemas introduced by SEC-16/SEC-07 (D9/D8).
 * `validatePaginationParams` is the shared base every list endpoint now goes through (5.11);
 * `validateGetAdminUsersRequest` is the admin-listing endpoint's own extension of it (5.12),
 * previously bypassed by a manual `page ? Number(page) : 1` parse. `validateUpdateSelf` covers
 * the `PATCH /me` schema, which had `password` deleted and is `.strict()` (5.4).
 */
import {
  validateGetAdminUsersRequest,
  validatePaginationParams,
  validateUpdateSelf,
} from "./validations";

describe("validations / bounded pagination (validatePaginationParams)", () => {
  it("defaults page to 1 and limit to PAGE_SIZE when omitted", async () => {
    const result = await validatePaginationParams({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it("coerces string query parameters to numbers", async () => {
    const result = await validatePaginationParams({ page: "3", limit: "25" });
    expect(result.page).toBe(3);
    expect(typeof result.page).toBe("number");
    expect(result.limit).toBe(25);
    expect(typeof result.limit).toBe("number");
  });

  it("accepts the lower and upper bounds for page and limit", async () => {
    await expect(validatePaginationParams({ page: 1, limit: 1 })).resolves.toMatchObject({
      page: 1,
      limit: 1,
    });
    await expect(validatePaginationParams({ page: 10_000, limit: 100 })).resolves.toMatchObject({
      page: 10_000,
      limit: 100,
    });
  });

  it("rejects a page below the lower bound", async () => {
    await expect(validatePaginationParams({ page: 0 })).rejects.toThrow();
  });

  it("rejects a page above the upper bound", async () => {
    await expect(validatePaginationParams({ page: 10_001 })).rejects.toThrow();
  });

  it("rejects a limit below the lower bound", async () => {
    await expect(validatePaginationParams({ limit: 0 })).rejects.toThrow();
  });

  it("rejects a limit above the upper bound", async () => {
    await expect(validatePaginationParams({ limit: 101 })).rejects.toThrow();
  });

  it("rejects a non-finite page instead of letting it reach offset arithmetic", async () => {
    await expect(validatePaginationParams({ page: "Infinity" })).rejects.toThrow();
    await expect(validatePaginationParams({ page: "not-a-number" })).rejects.toThrow();
  });

  it("rejects a fractional page or limit", async () => {
    await expect(validatePaginationParams({ page: 1.5 })).rejects.toThrow();
    await expect(validatePaginationParams({ limit: 2.5 })).rejects.toThrow();
  });

  it("rejects unknown properties, since the schema is strict", async () => {
    await expect(validatePaginationParams({ page: 1, offset: 50 })).rejects.toThrow();
  });
});

describe("validations / admin user listing pagination (validateGetAdminUsersRequest)", () => {
  it("inherits the shared bounds — an out-of-range page is rejected", async () => {
    await expect(validateGetAdminUsersRequest({ page: 0 })).rejects.toThrow();
    await expect(validateGetAdminUsersRequest({ page: 10_001 })).rejects.toThrow();
  });

  it("inherits the shared bounds — an out-of-range limit is rejected", async () => {
    await expect(validateGetAdminUsersRequest({ limit: 0 })).rejects.toThrow();
    await expect(validateGetAdminUsersRequest({ limit: 101 })).rejects.toThrow();
  });

  it("accepts its own search and communityId fields alongside valid pagination", async () => {
    const communityId = "11111111-1111-4111-8111-111111111111";
    const result = await validateGetAdminUsersRequest({
      page: 2,
      limit: 20,
      search: "someone",
      communityId,
    });
    expect(result).toMatchObject({ page: 2, limit: 20, search: "someone", communityId });
  });

  it("rejects a non-uuid communityId", async () => {
    await expect(validateGetAdminUsersRequest({ communityId: "not-a-uuid" })).rejects.toThrow();
  });
});

describe("validations / PATCH /me rejects a password field (validateUpdateSelf)", () => {
  it("rejects the whole request when password is present", async () => {
    await expect(
      validateUpdateSelf({ firstName: "Ana", password: "someNewPassword123" }),
    ).rejects.toThrow();
  });

  it("rejects a request that only carries password", async () => {
    await expect(validateUpdateSelf({ password: "someNewPassword123" })).rejects.toThrow();
  });

  it("still accepts a valid update with no password field", async () => {
    await expect(validateUpdateSelf({ firstName: "Ana" })).resolves.toMatchObject({
      firstName: "Ana",
    });
  });
});
