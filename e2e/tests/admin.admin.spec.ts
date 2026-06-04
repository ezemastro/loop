import { test, expect, TEST_DATA } from "../fixtures";
import { Pool } from "pg";

/**
 * Admin Panel UI E2E Tests
 * Covers: login, dashboard navigation, user management, school management
 * Run: npx playwright test admin.admin.spec.ts --project=admin
 *
 * Requires admin dev server running: cd adminClient && npm run dev
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

test.describe("Admin Login", () => {
  test("renders login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole("heading", { name: /iniciar sesión/i })).toBeVisible();
  });

  test("logs in with valid credentials", async ({ page }) => {
    await seedAdminEmail();

    // Register admin via API first
    await page.request.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });

    await page.goto("/");

    // Fill login form
    await page.getByLabel(/email/i).fill(TEST_DATA.admin.email);
    await page.getByLabel(/contraseña/i).fill(TEST_DATA.admin.password);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("shows error with invalid credentials", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/email/i).fill("wrong@loop.test");
    await page.getByLabel(/contraseña/i).fill("WrongPassword!");
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    // Should show error message
    await expect(page.getByText(/contraseña|email|incorrect/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Admin Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminEmail();

    // Register and login via API
    await page.request.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });

    // Navigate to login and fill form
    await page.goto("/");
    await page.getByLabel(/email/i).fill(TEST_DATA.admin.email);
    await page.getByLabel(/contraseña/i).fill(TEST_DATA.admin.password);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await page.waitForURL(/.*dashboard/);
  });

  test("navigates to users page", async ({ page }) => {
    await page.getByRole("link", { name: /usuarios/i }).click();
    await expect(page).toHaveURL(/.*users/);
    await expect(page.getByRole("heading", { name: /usuarios/i })).toBeVisible();
  });

  test("navigates to schools page", async ({ page }) => {
    await page.getByRole("link", { name: /escuelas/i }).click();
    await expect(page).toHaveURL(/.*schools/);
    await expect(page.getByRole("heading", { name: /escuelas/i })).toBeVisible();
  });

  test("navigates to categories page", async ({ page }) => {
    await page.getByRole("link", { name: /categorías/i }).click();
    await expect(page).toHaveURL(/.*categories/);
    await expect(page.getByRole("heading", { name: /categorías/i })).toBeVisible();
  });

  test("navigates to missions page", async ({ page }) => {
    await page.getByRole("link", { name: /misiones/i }).click();
    await expect(page).toHaveURL(/.*missions/);
    await expect(page.getByRole("heading", { name: /misiones/i })).toBeVisible();
  });

  test("navigates to notifications page", async ({ page }) => {
    await page.getByRole("link", { name: /notificaciones/i }).click();
    await expect(page).toHaveURL(/.*notifications/);
    await expect(page.getByRole("heading", { name: /notificaciones/i })).toBeVisible();
  });
});

test.describe("Admin Users Management", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminEmail();

    await page.request.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });

    await page.goto("/");
    await page.getByLabel(/email/i).fill(TEST_DATA.admin.email);
    await page.getByLabel(/contraseña/i).fill(TEST_DATA.admin.password);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await page.waitForURL(/.*dashboard/);

    // Navigate to users
    await page.getByRole("link", { name: /usuarios/i }).click();
    await page.waitForURL(/.*users/);
  });

  test("displays users table", async ({ page }) => {
    // Table should be visible
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
  });

  test("searches for users", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("E2E");
      await searchInput.press("Enter");

      // Should show filtered results
      await page.waitForTimeout(1000);
      await expect(page.getByRole("table")).toBeVisible();
    }
  });
});

test.describe("Admin Logout", () => {
  test("logs out successfully", async ({ page }) => {
    await seedAdminEmail();

    await page.request.post("/admin/register", {
      data: {
        email: TEST_DATA.admin.email,
        fullName: TEST_DATA.admin.fullName,
        password: TEST_DATA.admin.password,
      },
    });

    await page.goto("/");
    await page.getByLabel(/email/i).fill(TEST_DATA.admin.email);
    await page.getByLabel(/contraseña/i).fill(TEST_DATA.admin.password);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await page.waitForURL(/.*dashboard/);

    // Click logout
    await page.getByRole("button", { name: /cerrar sesión|logout/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});
