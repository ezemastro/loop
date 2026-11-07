// Named scenes for the changelog capture. Each scene drives a Playwright page to one screen state.
//
// Contract: { name, demo, height?, run(page, ctx) }
//   demo   true  -> `page` is already inside demo mode on the home feed when `run` starts.
//          false -> `page` is blank; `run` must navigate itself (ctx.base + path).
//   height optional viewport height override: the app scrolls in an inner div, so `fullPage` does
//          not work; a scene that wants to show more taller content asks for a taller viewport.
//
// In demo mode a reload exits the demo, so scenes move with `go()` (history API), never `goto`.

/** Client-side navigation that keeps the demo session alive. */
export async function go(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, "", p);
    dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, path);
  await page.waitForFunction((p) => location.pathname.includes(p), path, { timeout: 15000 });
}

const clickText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().click({ timeout: 15000 });
};

const waitText = async (page, text) => {
  await page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
};

/** Visible search field (the header bar on wide screens, the screen's own on narrow ones). */
const searchInput = (page) => page.locator('input[placeholder^="Buscar"]:visible').first();

export const SCENES = [
  {
    name: "home",
    demo: true,
    run: async (page) => {
      await go(page, "/home");
    },
  },
  {
    name: "search",
    demo: true,
    run: async (page) => {
      await go(page, "/search");
      await waitText(page, "Set de geometría");
    },
  },
  {
    name: "search-empty",
    demo: true,
    run: async (page) => {
      await go(page, "/search");
      await waitText(page, "Set de geometría");
      const input = searchInput(page);
      await input.fill("zzzzqqqq");
      await input.press("Enter");
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "filters-modal",
    demo: true,
    run: async (page) => {
      await go(page, "/search");
      await waitText(page, "Set de geometría");
      await clickText(page, "Filtros");
      await page.waitForTimeout(600);
    },
  },
  {
    name: "listing",
    demo: true,
    height: 1100,
    run: async (page) => {
      await go(page, "/search");
      await clickText(page, "Set de geometría");
      await page.waitForFunction(() => /\/listing\//.test(location.pathname), null, {
        timeout: 15000,
      });
    },
  },
  {
    name: "offer",
    demo: true,
    run: async (page) => {
      await go(page, "/search");
      await clickText(page, "Set de geometría");
      await page.waitForFunction(() => /\/listing\//.test(location.pathname), null, {
        timeout: 15000,
      });
      await go(page, `${new URL(page.url()).pathname}/offer`);
    },
  },
  {
    name: "publish",
    demo: true,
    height: 1100,
    run: async (page) => {
      await go(page, "/publish");
    },
  },
  {
    name: "wishlist",
    demo: true,
    run: async (page) => {
      await go(page, "/wishlist");
    },
  },
  {
    name: "profile",
    demo: true,
    run: async (page) => {
      await go(page, "/profile");
    },
  },
  {
    name: "notifications",
    demo: true,
    run: async (page) => {
      await go(page, "/notifications");
    },
  },
  {
    name: "messages",
    demo: true,
    run: async (page) => {
      await go(page, "/messages");
      await waitText(page, "Sofía López");
    },
  },
  {
    name: "chat",
    demo: true,
    run: async (page) => {
      await go(page, "/messages");
      await clickText(page, "Sofía López");
      await page.waitForFunction(() => /\/messages\/[^/]+/.test(location.pathname), null, {
        timeout: 15000,
      });
    },
  },
  {
    name: "settings",
    demo: true,
    run: async (page) => {
      await go(page, "/settings");
    },
  },
  {
    name: "login",
    demo: false,
    run: async (page, { base }) => {
      await page.goto(`${base}/login`, { waitUntil: "load" });
    },
  },
  {
    name: "register",
    demo: false,
    run: async (page, { base }) => {
      await page.goto(`${base}/register`, { waitUntil: "load" });
    },
  },
  {
    name: "not-found",
    demo: false,
    run: async (page, { base }) => {
      await page.goto(`${base}/esta-pagina-no-existe`, { waitUntil: "load" });
    },
  },
];
