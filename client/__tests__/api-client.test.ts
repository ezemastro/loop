import type { AxiosError } from "axios";

import { api, shouldLogout } from "../api/loop";
import { useSessionStore } from "../stores/session";

/**
 * `api/loop.ts` transitively imports `@/demo` -> `../../shared/demo-data`, and that shared module
 * fails to resolve `@babel/runtime` under jest (a pre-existing cross-package resolution gap — the
 * repo root has no `node_modules/@babel/runtime`, out of scope for this change). Stubbed here so
 * these tests exercise the real interceptor wiring without depending on demo internals, which this
 * suite is not testing.
 */
jest.mock("@/demo", () => ({
  DEMO_READ_ONLY_ERROR_CODE: "DEMO_MODE_READ_ONLY",
  demoAdapter: jest.fn(),
  enableDemoMode: jest.fn(),
  disableDemoMode: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const makeError = (opts: {
  status?: number;
  hasAuthHeader?: boolean;
  url?: string;
  noResponse?: boolean;
}): AxiosError =>
  ({
    isAxiosError: true,
    response: opts.noResponse ? undefined : { status: opts.status, data: {} },
    config: {
      headers: opts.hasAuthHeader ? { Authorization: "Bearer token" } : {},
      url: opts.url ?? "/listings",
    },
  }) as unknown as AxiosError;

describe("shouldLogout", () => {
  it("a 401 with the Authorization header on a non-/auth/ path logs out", () => {
    expect(shouldLogout(makeError({ status: 401, hasAuthHeader: true, url: "/listings" }))).toBe(
      true,
    );
  });

  it("a 401 with the Authorization header on /auth/login does not log out", () => {
    expect(shouldLogout(makeError({ status: 401, hasAuthHeader: true, url: "/auth/login" }))).toBe(
      false,
    );
  });

  it("a 401 without the Authorization header does not log out", () => {
    expect(shouldLogout(makeError({ status: 401, hasAuthHeader: false, url: "/listings" }))).toBe(
      false,
    );
  });

  it("a 403 with the Authorization header does not log out", () => {
    expect(shouldLogout(makeError({ status: 403, hasAuthHeader: true, url: "/listings" }))).toBe(
      false,
    );
  });

  it("a network error with no response does not log out", () => {
    expect(shouldLogout(makeError({ hasAuthHeader: true, noResponse: true }))).toBe(false);
  });
});

describe("api response interceptor", () => {
  const getRejectedHandler = () => {
    const handlers = (
      api.interceptors.response as unknown as {
        handlers: { rejected: (error: unknown) => Promise<never> }[];
      }
    ).handlers;
    return handlers[handlers.length - 1].rejected;
  };

  beforeEach(() => {
    useSessionStore.setState({ authToken: "existing-token", user: null });
  });

  it("logs out on an authenticated non-/auth/ 401", async () => {
    const rejected = getRejectedHandler();
    const error = makeError({ status: 401, hasAuthHeader: true, url: "/listings" });
    await expect(rejected(error)).rejects.toBe(error);
    expect(useSessionStore.getState().authToken).toBeNull();
  });

  it("does not log out on a wrong-password /auth/login 401", async () => {
    const rejected = getRejectedHandler();
    const error = makeError({ status: 401, hasAuthHeader: true, url: "/auth/login" });
    await expect(rejected(error)).rejects.toBe(error);
    expect(useSessionStore.getState().authToken).toBe("existing-token");
  });

  it("does not log out on an anonymous 401", async () => {
    const rejected = getRejectedHandler();
    const error = makeError({ status: 401, hasAuthHeader: false, url: "/listings" });
    await expect(rejected(error)).rejects.toBe(error);
    expect(useSessionStore.getState().authToken).toBe("existing-token");
  });

  it("does not log out on a non-401 error", async () => {
    const rejected = getRejectedHandler();
    const error = makeError({ status: 500, hasAuthHeader: true, url: "/listings" });
    await expect(rejected(error)).rejects.toBe(error);
    expect(useSessionStore.getState().authToken).toBe("existing-token");
  });
});
