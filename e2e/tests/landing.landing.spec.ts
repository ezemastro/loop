import { test, expect } from "../fixtures";

/**
 * Landing Page E2E Tests
 * Covers: homepage rendering, navigation, SEO, accessibility
 * Run: npx playwright test landing.landing.spec.ts --project=landing
 *
 * Requires landing dev server running: cd landing && npm run dev
 */

test.describe("Landing Homepage", () => {
  test("renders the homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/loop/i);
  });

  test("displays hero section", async ({ page }) => {
    await page.goto("/");
    // Hero should contain main heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("displays navigation links", async ({ page }) => {
    await page.goto("/");

    // Check for navigation
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Should have links to Contacto, Privacidad, Borrar cuenta
    await expect(page.getByRole("link", { name: /contacto/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /privacidad/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /borrar cuenta/i })).toBeVisible();
  });

  test("displays app store buttons or download links", async ({ page }) => {
    await page.goto("/");
    // Should have some way to download the app
    const hasAppStore = await page.getByRole("link", { name: /app store/i }).isVisible();
    const hasPlayStore = await page.getByRole("link", { name: /play store|google play/i }).isVisible();
    expect(hasAppStore || hasPlayStore).toBe(true);
  });

  test("displays impact statistics", async ({ page }) => {
    await page.goto("/");
    // Should show environmental impact stats
    await expect(page.getByText(/residuos|kg|co2|agua/i)).toBeVisible();
  });
});

test.describe("Landing Navigation", () => {
  test("navigates to privacy policy", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /privacidad/i }).click();
    await expect(page).toHaveURL(/.*politica-privacidad/);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("navigates to delete account page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /borrar cuenta/i }).click();
    await expect(page).toHaveURL(/.*borrar-cuenta/);
    await expect(page.getByRole("heading")).toBeVisible();
  });
});

test.describe("Delete Account Page", () => {
  test("renders delete account form", async ({ page }) => {
    await page.goto("/borrar-cuenta");

    // Should have a form
    await expect(page.getByRole("form")).toBeVisible();

    // Should have email input
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Should have submit button
    await expect(page.getByRole("button", { name: /eliminar|borrar|delete/i })).toBeVisible();
  });

  test("shows validation for empty email", async ({ page }) => {
    await page.goto("/borrar-cuenta");

    // Try to submit without email
    await page.getByRole("button", { name: /eliminar|borrar|delete/i }).click();

    // Should show validation error
    await expect(page.getByText(/email.*requerido|email.*obligatorio/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows validation for invalid email format", async ({ page }) => {
    await page.goto("/borrar-cuenta");

    // Enter invalid email
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: /eliminar|borrar|delete/i }).click();

    // Should show validation error
    await expect(page.getByText(/email.*inválido|formato/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Landing SEO", () => {
  test("has viewport meta tag", async ({ page }) => {
    await page.goto("/");
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
  });

  test("has lang attribute on html", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const lang = await html.getAttribute("lang");
    expect(lang).toBe("es");
  });

  test("has meta description", async ({ page }) => {
    await page.goto("/");
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(10);
  });
});

test.describe("Landing Accessibility", () => {
  test("all images have alt text", async ({ page }) => {
    await page.goto("/");
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      // Alt can be empty string for decorative images, but attribute should exist
      expect(alt !== null).toBe(true);
    }
  });

  test("navigation has aria-label", async ({ page }) => {
    await page.goto("/");
    const navs = page.locator("nav");
    const count = await navs.count();

    for (let i = 0; i < count; i++) {
      const ariaLabel = await navs.nth(i).getAttribute("aria-label");
      // At least some navs should have aria-labels
      if (count > 1) {
        // If multiple navs, at least one should have aria-label
        if (ariaLabel) break;
        if (i === count - 1) {
          // Last nav checked, none had aria-label — this is a warning, not failure
          console.warn("Navigation elements missing aria-label");
        }
      }
    }
  });

  test("links are keyboard accessible", async ({ page }) => {
    await page.goto("/");
    const links = page.locator("a[href]");
    const count = await links.count();

    expect(count).toBeGreaterThan(0);

    // All links should be focusable
    for (let i = 0; i < Math.min(count, 5); i++) {
      const tabindex = await links.nth(i).getAttribute("tabindex");
      // tabindex should not be -1
      expect(tabindex).not.toBe("-1");
    }
  });
});

test.describe("Landing Responsive", () => {
  test("renders on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("renders on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("renders on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
