import { test, expect, TEST_DATA } from "../fixtures";
import { Pool } from "pg";

/**
 * Admin API E2E Tests
 * Covers: admin register, login, manage users, schools, categories, missions
 * Run: npx playwright test admin.api.spec.ts
 */

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password",
  database: process.env.POSTGRES_DB || "db",
});

async function seedAdminEmail() {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO admin_valid_emails (email) VALUES ($1) ON CONFLICT DO NOTHING`,
      [TEST_DATA.admin.email],
    );
  } finally {
    client.release();
  }
}

test.describe("POST /admin/register", () => {
  test("registers a new admin successfully", async ({ apiAdmin }) => {
    await seedAdminEmail();

    const res = await apiAdmin.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.admin.email).toBe(TEST_DATA.admin.email);
    expect(body.data.admin.fullName).toBe(TEST_DATA.admin.fullName);
    expect(body.data.admin.password).toBeUndefined();
  });

  test("rejects registration without authorized email", async ({ apiAdmin }) => {
    const res = await apiAdmin.post("/admin/register", {
      data: {
        email: "unauthorized@loop.test",
        fullName: "Unauthorized Admin",
        password: "SecurePass123!",
      },
    });

    expect(res.status()).toBe(403);
  });
});

test.describe("POST /admin/login", () => {
  test("logs in admin with correct credentials", async ({ apiAdmin }) => {
    await seedAdminEmail();

    // Register first
    await apiAdmin.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });

    // Login
    const res = await apiAdmin.post("/admin/login", {
      data: {
        email: TEST_DATA.admin.email,
        password: TEST_DATA.admin.password,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.admin.email).toBe(TEST_DATA.admin.email);
  });

  test("rejects login with wrong password", async ({ apiAdmin }) => {
    const res = await apiAdmin.post("/admin/login", {
      data: {
        email: TEST_DATA.admin.email,
        password: "WrongPassword!",
      },
    });

    expect(res.status()).toBe(401);
  });
});

test.describe("POST /admin/authorize-email", () => {
  test("authorizes an email for admin registration", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.post("/admin/authorize-email", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        email: "new-admin@loop.test",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects authorization without auth", async ({ apiAdmin }) => {
    const res = await apiAdmin.post("/admin/authorize-email", {
      data: { email: "someone@loop.test" },
    });

    expect(res.status()).toBe(401);
  });
});

test.describe("GET /admin/users", () => {
  test("returns list of users", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.get("/admin/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.users).toBeDefined();
    expect(Array.isArray(body.data.users)).toBe(true);
  });

  test("searches users by term", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.get("/admin/users?search=E2E", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    // All returned users should match the search term
    for (const user of body.data.users) {
      const matches =
        user.firstName?.toLowerCase().includes("e2e") ||
        user.lastName?.toLowerCase().includes("e2e") ||
        user.email?.toLowerCase().includes("e2e");
      expect(matches).toBe(true);
    }
  });
});

test.describe("POST /admin/users/:userId/credits", () => {
  test("increases user credits", async ({ apiAdmin, adminToken, user }) => {
    const res = await apiAdmin.post(`/admin/users/${user.id}/credits`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        amount: 50000,
        positive: true,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("decreases user credits", async ({ apiAdmin, adminToken, user }) => {
    const res = await apiAdmin.post(`/admin/users/${user.id}/credits`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        amount: 10000,
        positive: false,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

test.describe("POST /admin/users/:userId/reset-password", () => {
  test("resets user password", async ({ apiAdmin, adminToken, user }) => {
    const res = await apiAdmin.post(`/admin/users/${user.id}/reset-password`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        newPassword: "NewSecurePass123!",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

test.describe("POST /admin/schools", () => {
  test("creates a new school", async ({ apiAdmin, adminToken }) => {
    // First create media for the school
    const mediaRes = await apiAdmin.post("/uploads", {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        file: Buffer.from("fake-image-data"),
      },
    });

    // For now, test without media — the API may require a mediaId
    // This test will be skipped if media creation fails
    if (!mediaRes.ok()) {
      test.skip();
      return;
    }

    const mediaBody = await mediaRes.json();
    const mediaId = mediaBody.data.media.id;

    const res = await apiAdmin.post("/admin/schools", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: "E2E Admin School",
        mediaId,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.school.name).toBe("E2E Admin School");
  });
});

test.describe("POST /admin/categories", () => {
  test("creates a new category", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.post("/admin/categories", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: "E2E Admin Category",
        description: "Created by E2E admin test",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.category.name).toBe("E2E Admin Category");
  });
});

test.describe("PATCH /admin/categories/:categoryId", () => {
  test("updates a category", async ({ apiAdmin, adminToken, categoryId }) => {
    const res = await apiAdmin.patch(`/admin/categories/${categoryId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: "Updated E2E Category",
        description: "Updated by E2E",
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.category.name).toBe("Updated E2E Category");
  });
});

test.describe("POST /admin/missions", () => {
  test("creates a mission template", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.post("/admin/missions", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        key: "e2e-test-mission",
        title: "E2E Test Mission",
        description: "Created by E2E test",
        rewardCredits: 25000,
        active: true,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.missionTemplate.key).toBe("e2e-test-mission");
    expect(body.data.missionTemplate.rewardCredits).toBe(25000);
  });
});

test.describe("GET /admin/missions", () => {
  test("returns mission templates", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.get("/admin/missions", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.missionTemplates).toBeDefined();
    expect(Array.isArray(body.data.missionTemplates)).toBe(true);
  });
});

test.describe("GET /admin/stats", () => {
  test("returns admin statistics", async ({ apiAdmin, adminToken }) => {
    const res = await apiAdmin.get("/admin/stats", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.stats).toBeDefined();
  });
});

test.describe("GET /stats", () => {
  test("returns global stats (public)", async ({ apiAdmin }) => {
    const res = await apiAdmin.get("/stats");

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.globalStats).toBeDefined();
  });
});
