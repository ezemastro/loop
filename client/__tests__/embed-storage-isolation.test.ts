/**
 * `embed-demo-storage-isolation` (`marketing-landing` T7): on the embeddable live-demo route,
 * `webStorage` must swap the shared `localStorage`-backed `AsyncStorage` for an in-memory
 * stand-in, so entering the demo inside the `<iframe>` never persists a session or theme the
 * parent landing page (same origin) could pick up on a later, non-embedded visit to `/`.
 *
 * `jest.mock` factories may only reference out-of-scope `mock*` variables (hoisting), so
 * `isEmbedRoute` is set through a mutable mock module rather than re-importing per test.
 */

const mockEmbedMode = { isEmbedRoute: false };
jest.mock("@/services/embedMode", () => mockEmbedMode);

const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

/** `jest.resetModules()` clears the require cache but keeps the `jest.mock` registrations above
 * active, so a fresh `require` after it picks up the current `mockEmbedMode.isEmbedRoute`. Typed
 * via `typeof import(...)` rather than a real `import()`, which this project's CJS jest transform
 * doesn't support without `--experimental-vm-modules`. */
const requireWebStorage = (): typeof import("@/services/webStorage") =>
  require("@/services/webStorage");

describe("webStorage", () => {
  beforeEach(() => {
    jest.resetModules();
    mockEmbedMode.isEmbedRoute = false;
    Object.values(mockAsyncStorage).forEach((fn) => fn.mockReset());
  });

  it("passes through to the real AsyncStorage outside the embed route", () => {
    mockEmbedMode.isEmbedRoute = false;
    const { webStorage } = requireWebStorage();
    expect(webStorage).toBe(mockAsyncStorage);
  });

  it("uses an isolated in-memory store on the embed route, never touching AsyncStorage", async () => {
    mockEmbedMode.isEmbedRoute = true;
    const { webStorage } = requireWebStorage();
    expect(webStorage).not.toBe(mockAsyncStorage);

    await webStorage.setItem("session-storage", JSON.stringify({ demoMode: true }));
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();

    const read = await webStorage.getItem("session-storage");
    expect(read).toBe(JSON.stringify({ demoMode: true }));
    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it("an embed-route write is invisible to a fresh, non-embed import (no shared module state leak)", async () => {
    mockEmbedMode.isEmbedRoute = true;
    const embedStorage = requireWebStorage().webStorage;
    await embedStorage.setItem("session-storage", "leaked?");

    jest.resetModules();
    mockEmbedMode.isEmbedRoute = false;
    const freshStorage = requireWebStorage().webStorage;
    expect(freshStorage).toBe(mockAsyncStorage);
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalledWith("session-storage", "leaked?");
  });
});
