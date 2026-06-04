import { test, expect, TEST_DATA } from "../fixtures";

/**
 * Auth API E2E Tests
 * Covers: register, login, me, self-update
 * Run: npx playwright test auth.api.spec.ts
 */

test.describe("POST /auth/register", () => {
  test("registers a new user successfully", async ({ apiUser, schoolId }) => {
    const email = "register-e2e@northfield.edu.ar";
    const res = await apiUser.post("/auth/register", {
      data: {
        email,
        password: "SecurePass123!",
        firstName: "Register",
        lastName: "Test",
        schoolIds: [schoolId],
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toBeDefined();
    expect(body.data.user.email).toBe(email);
    expect(body.data.user.firstName).toBe("Register");
    expect(body.data.token).toBeDefined();
    expect(body.data.user.password).toBeUndefined();
  });

  test("rejects registration with missing fields", async ({ apiUser }) => {
    const res = await apiUser.post("/auth/register", {
      data: { email: "incomplete@northfield.edu.ar" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects registration with duplicate email", async ({ apiUser, schoolId }) => {
    const email = "dup-e2e@northfield.edu.ar";

    const res1 = await apiUser.post("/auth/register", {
      data: {
        email,
        password: "SecurePass123!",
        firstName: "First",
        lastName: "User",
        schoolIds: [schoolId],
      },
    });
    expect(res1.status()).toBe(201);

    const res2 = await apiUser.post("/auth/register", {
      data: {
        email,
        password: "SecurePass123!",
        firstName: "Second",
        lastName: "User",
        schoolIds: [schoolId],
      },
    });
    expect(res2.status()).toBe(409);
  });

  test("rejects weak password", async ({ apiUser, schoolId }) => {
    const res = await apiUser.post("/auth/register", {
      data: {
        email: "weak-e2e@northfield.edu.ar",
        password: "123",
        firstName: "Weak",
        lastName: "Pass",
        schoolIds: [schoolId],
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("POST /auth/login", () => {
  test("logs in with correct credentials", async ({ apiUser, schoolId }) => {
    const email = "login-e2e@northfield.edu.ar";
    const password = "SecurePass123!";

    // Register first
    await apiUser.post("/auth/register", {
      data: { email, password, firstName: "Login", lastName: "Test", schoolIds: [schoolId] },
    });

    const res = await apiUser.post("/auth/login", {
      data: { email, password },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(email);
    expect(body.data.token).toBeDefined();
  });

  test("rejects login with wrong credentials", async ({ apiUser, schoolId }) => {
    const email = "wrong-e2e@northfield.edu.ar";

    await apiUser.post("/auth/register", {
      data: {
        email,
        password: "SecurePass123!",
        firstName: "Wrong",
        lastName: "Pass",
        schoolIds: [schoolId],
      },
    });

    const res = await apiUser.post("/auth/login", {
      data: { email, password: "WrongPassword!" },
    });

    // API returns 401 for auth failures
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test("rejects login with non-existent email", async ({ apiUser }) => {
    const res = await apiUser.post("/auth/login", {
      data: {
        email: "noexist-e2e@northfield.edu.ar",
        password: "SecurePass123!",
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

test.describe("GET /me", () => {
  test("returns current user with valid token", async ({ apiUser, userToken }) => {
    const res = await apiUser.get("/me", {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(TEST_DATA.user.email);
    expect(body.data.user.password).toBeUndefined();
    expect(body.data.user.googleId).toBeUndefined();
  });

  test("returns 401 without token", async ({ apiUser }) => {
    const res = await apiUser.get("/me");
    expect(res.status()).toBe(401);
  });

  test("returns 401 with invalid token", async ({ apiUser }) => {
    const res = await apiUser.get("/me", {
      headers: { Authorization: "Bearer invalid-token-here" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("PATCH /me", () => {
  test("updates user profile", async ({ apiUser, userToken }) => {
    const res = await apiUser.patch("/me", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        firstName: "Updated",
        lastName: "Name",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.firstName).toBe("Updated");
    expect(body.data.user.lastName).toBe("Name");
  });

  test("updates phone number", async ({ apiUser, userToken }) => {
    const res = await apiUser.patch("/me", {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        phone: "+5491112345678",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.user.phone).toBe("+5491112345678");
  });
});

test.describe("GET /status", () => {
  test("returns server status", async ({ apiUser }) => {
    const res = await apiUser.get("/status");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("Server is running");
  });
});
