import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";
import { Pool, type PoolClient } from "pg";

// ---------------------------------------------------------------------------
// Database pool — connects to the same DB the API uses
// ---------------------------------------------------------------------------

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password",
  database: process.env.POSTGRES_DB || "db",
});

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

export const TEST_DATA = {
  admin: {
    email: "e2e-admin@reditinere.com",
    fullName: "E2E Admin",
    password: "TestPass123!",
  },
  user: {
    email: "e2e-user@northfield.edu.ar",
    firstName: "E2E",
    lastName: "User",
    password: "TestPass123!",
  },
  user2: {
    email: "e2e-user2@northfield.edu.ar",
    firstName: "E2E",
    lastName: "User2",
    password: "TestPass123!",
  },
  school: {
    name: "E2E Test School",
  },
  category: {
    name: "E2E Test Category",
  },
};

// ---------------------------------------------------------------------------
// DB helper functions
// ---------------------------------------------------------------------------

async function cleanDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM notifications`);
    await client.query(`DELETE FROM wallet_transactions`);
    await client.query(`DELETE FROM listing_trades`);
    await client.query(`DELETE FROM listing_media`);
    await client.query(`DELETE FROM listings`);
    await client.query(`DELETE FROM messages`);
    await client.query(`DELETE FROM user_missions`);
    await client.query(`DELETE FROM users_wishes`);
    await client.query(`DELETE FROM user_schools`);
    await client.query(`DELETE FROM users`);
    await client.query(`DELETE FROM mission_templates WHERE key LIKE 'e2e-%'`);
    await client.query(`DELETE FROM categories WHERE name LIKE 'E2E%'`);
    await client.query(`DELETE FROM admin_valid_emails WHERE email LIKE 'e2e-%'`);
    await client.query(`DELETE FROM admins WHERE email LIKE 'e2e-%'`);
    // Delete schools referencing e2e media, then the media itself
    await client.query(`DELETE FROM schools WHERE media_id IN (SELECT id FROM media WHERE url LIKE 'e2e-%')`);
    await client.query(`DELETE FROM media WHERE url LIKE 'e2e-%'`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function seedSchool(client: PoolClient): Promise<string> {
  // Create a media entry for the school
  const mediaRes = await client.query(
    `INSERT INTO media (url, mime, media_type) VALUES ($1, $2, $3) RETURNING id`,
    [`e2e-school-logo.png`, "image/png", "image"],
  );
  const mediaId = mediaRes.rows[0].id;

  const schoolRes = await client.query(
    `INSERT INTO schools (name, media_id) VALUES ($1, $2) RETURNING id`,
    [TEST_DATA.school.name, mediaId],
  );
  return schoolRes.rows[0].id;
}

async function seedCategory(client: PoolClient): Promise<string> {
  const catRes = await client.query(
    `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
    [TEST_DATA.category.name],
  );
  return catRes.rows[0].id;
}

async function seedAdminEmail(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO admin_valid_emails (email) VALUES ($1) ON CONFLICT DO NOTHING`,
    [TEST_DATA.admin.email],
  );
}

async function registerAdmin(api: APIRequestContext): Promise<{ token: string; admin: any }> {
  await seedAdminEmail(await pool.connect().then((c) => {
    c.release();
    return pool.connect();
  }).then(async (c) => {
    await seedAdminEmail(c);
    c.release();
    return c;
  }));

  const res = await api.post("/admin/register", {
    data: {
      email: TEST_DATA.admin.email,
      fullName: TEST_DATA.admin.fullName,
      password: TEST_DATA.admin.password,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  return { token: body.data.token, admin: body.data.admin };
}

async function registerUser(api: APIRequestContext, schoolId: string): Promise<{ token: string; user: any }> {
  const res = await api.post("/auth/register", {
    data: {
      email: TEST_DATA.user.email,
      password: TEST_DATA.user.password,
      firstName: TEST_DATA.user.firstName,
      lastName: TEST_DATA.user.lastName,
      schoolIds: [schoolId],
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  return { token: body.data.token, user: body.data.user };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface LoopFixtures {
  dbPool: typeof pool;
  cleanDb: () => Promise<void>;
  apiAdmin: APIRequestContext;
  apiUser: APIRequestContext;
  apiUser2: APIRequestContext;
  schoolId: string;
  categoryId: string;
  adminToken: string;
  userToken: string;
  user2Token: string;
  adminUser: any;
  user: any;
  user2: any;
}

export const test = base.extend<LoopFixtures>({
  dbPool: async ({}, use) => {
    await use(pool);
  },

  cleanDb: async ({}, use) => {
    await use(cleanDatabase);
  },

  apiAdmin: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.API_URL || "http://localhost:3000",
    });
    await use(ctx);
    await ctx.dispose();
  },

  apiUser: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.API_URL || "http://localhost:3000",
    });
    await use(ctx);
    await ctx.dispose();
  },

  apiUser2: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.API_URL || "http://localhost:3000",
    });
    await use(ctx);
    await ctx.dispose();
  },

  schoolId: async ({ cleanDb }, use) => {
    await cleanDb();
    const client = await pool.connect();
    try {
      const id = await seedSchool(client);
      await use(id);
    } finally {
      client.release();
    }
  },

  categoryId: async ({}, use) => {
    const client = await pool.connect();
    try {
      const id = await seedCategory(client);
      await use(id);
    } finally {
      client.release();
    }
  },

  adminToken: async ({ apiAdmin, schoolId, categoryId }, use) => {
    const client = await pool.connect();
    try {
      await seedAdminEmail(client);
    } finally {
      client.release();
    }
    const res = await apiAdmin.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });
    const body = await res.json();
    await use(body.data.token);
  },

  userToken: async ({ apiUser, schoolId }, use) => {
    const res = await apiUser.post("/auth/register", {
      data: {
        email: TEST_DATA.user.email,
        password: TEST_DATA.user.password,
        firstName: TEST_DATA.user.firstName,
        lastName: TEST_DATA.user.lastName,
        schoolIds: [schoolId],
      },
    });
    const body = await res.json();
    await use(body.data.token);
  },

  user2Token: async ({ apiUser2, schoolId }, use) => {
    const res = await apiUser2.post("/auth/register", {
      data: {
        email: TEST_DATA.user2.email,
        password: TEST_DATA.user2.password,
        firstName: TEST_DATA.user2.firstName,
        lastName: TEST_DATA.user2.lastName,
        schoolIds: [schoolId],
      },
    });
    const body = await res.json();
    await use(body.data.token);
  },

  adminUser: async ({ apiAdmin, adminToken }, use) => {
    // Admin is created via adminToken fixture
    await use({ email: TEST_DATA.admin.email, fullName: TEST_DATA.admin.fullName });
  },

  user: async ({ apiUser, userToken }, use) => {
    const res = await apiUser.get("/me", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const body = await res.json();
    await use(body.data.user);
  },

  user2: async ({ apiUser2, user2Token }, use) => {
    const res = await apiUser2.get("/me", {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const body = await res.json();
    await use(body.data.user);
  },
});

export { expect };
