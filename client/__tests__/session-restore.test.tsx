import { act } from "react";
import { Text } from "react-native";
import type { ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithAct } from "./helpers/renderWithAct";
import { deriveRestoreStatus, type RestoreInput } from "@/services/sessionRestore";
import { useSessionStore } from "@/stores/session";
import { useSessionRestore } from "@/hooks/useSessionRestore";

jest.mock("@/demo", () => ({
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
jest.mock("expo-router", () => ({ usePathname: jest.fn(() => "/home") }));
jest.mock("@/api/loop", () => ({ api: { get: jest.fn() } }));
jest.mock("@/api/queryClient", () => ({ queryClient: { clear: jest.fn() } }));

// eslint-disable-next-line import/first
import { api } from "@/api/loop";
// eslint-disable-next-line import/first
import { usePathname } from "expo-router";

const USER = {
  id: "user-1",
  termsVersion: "old",
  community: undefined,
} as unknown as PrivateUser;

const base: RestoreInput = {
  mounted: true,
  hydrated: true,
  pathname: "/home",
  isWeb: true,
  hasToken: true,
  hasUser: false,
  query: { isError: false, isFetching: true, isPaused: false },
};
const status = (patch: Partial<RestoreInput>) => deriveRestoreStatus({ ...base, ...patch });

describe("deriveRestoreStatus", () => {
  it("waits while a stored token is exchanged for a user", () => {
    expect(status({})).toBe("restoring");
  });

  it("is ready without a token, so the logged-out screens show immediately", () => {
    expect(status({ hasToken: false })).toBe("ready");
  });

  it("is ready once the user exists", () => {
    expect(status({ hasUser: true })).toBe("ready");
  });

  it("is failed on a non-401 error and offline, but not while a retry is in flight", () => {
    const err = { isError: true, isFetching: false, isPaused: false };
    expect(status({ query: err })).toBe("failed");
    expect(status({ query: { ...err, isFetching: true } })).toBe("restoring");
    expect(status({ query: { isError: false, isFetching: false, isPaused: true } })).toBe("failed");
  });

  it("waits for storage before deciding", () => {
    expect(status({ hydrated: false, hasToken: false })).toBe("restoring");
  });

  it("keeps the static-export markup for prerendered routes on the first render (web)", () => {
    expect(status({ mounted: false, pathname: "/" })).toBe("ready");
    expect(status({ mounted: false, pathname: "/ingresar" })).toBe("ready");
    expect(status({ mounted: false, pathname: "/home" })).toBe("restoring");
    expect(status({ mounted: false, pathname: "/", isWeb: false })).toBe("restoring");
  });

  it("never gates the public legal routes or the embeddable demo", () => {
    for (const pathname of ["/privacidad", "/terminos", "/borrar-cuenta", "/demo"]) {
      expect(status({ pathname })).toBe("ready");
      expect(status({ pathname, mounted: false })).toBe("ready");
    }
  });
});

describe("useSessionRestore", () => {
  const mockGet = api.get as jest.Mock;
  let seen: { status: string; retry: () => void };

  const Probe = () => {
    const result = useSessionRestore();
    seen = result;
    return <Text>{result.status}</Text>;
  };

  let tree: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  const mount = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    tree = await renderWithAct(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    // Let the query settle and its follow-up renders flush.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    return tree;
  };

  const setSession = (patch: Partial<ReturnType<typeof useSessionStore.getState>>) =>
    useSessionStore.setState({
      user: null,
      authToken: null,
      hasAcceptedTerms: false,
      hasToken: false,
      demoMode: false,
      ...patch,
    });

  beforeAll(async () => {
    await useSessionStore.persist.rehydrate();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/home");
  });

  it("valid token: fetches /me, restores the user, then is ready", async () => {
    setSession({ authToken: "tok" });
    mockGet.mockResolvedValue({ data: { data: { user: USER } } });
    await mount();
    expect(mockGet).toHaveBeenCalledWith("/me");
    expect(useSessionStore.getState().user).toEqual(USER);
    expect(seen.status).toBe("ready");
  });

  it("demo token restores through the same /me call (the adapter answers it)", async () => {
    setSession({ authToken: "demo-token", demoMode: true });
    mockGet.mockResolvedValue({ data: { data: { user: USER } } });
    await mount();
    expect(mockGet).toHaveBeenCalledWith("/me");
    expect(seen.status).toBe("ready");
    expect(useSessionStore.getState().demoMode).toBe(true);
  });

  it("401: the interceptor logs out, which ends the wait on the logged-out screens", async () => {
    setSession({ authToken: "tok", hasAcceptedTerms: true });
    mockGet.mockImplementation(async () => {
      useSessionStore.getState().logout();
      throw { response: { status: 401 } };
    });
    await mount();
    expect(useSessionStore.getState().authToken).toBeNull();
    expect(seen.status).toBe("ready");
  });

  it("network error: keeps the token, reports failed, and retry recovers", async () => {
    setSession({ authToken: "tok" });
    mockGet.mockRejectedValue(new Error("Network Error"));
    await mount();
    expect(seen.status).toBe("failed");
    expect(useSessionStore.getState().authToken).toBe("tok");

    mockGet.mockResolvedValue({ data: { data: { user: USER } } });
    await act(async () => {
      await seen.retry();
    });
    // The user lands in the store from an effect after the refetch settles; on a loaded machine
    // that can take a few more ticks than the refetch promise itself.
    for (let i = 0; i < 50 && seen.status !== "ready"; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
    expect(seen.status).toBe("ready");
    expect(useSessionStore.getState().user).toEqual(USER);
  });

  it("no token: ready immediately and /me is never requested", async () => {
    setSession({});
    await mount();
    expect(mockGet).not.toHaveBeenCalled();
    expect(seen.status).toBe("ready");
  });

  it("re-derives terms acceptance from the restored user", async () => {
    setSession({ authToken: "tok", hasAcceptedTerms: true });
    mockGet.mockResolvedValue({ data: { data: { user: USER } } });
    await mount();
    // `USER.termsVersion` is not the current TERMS_VERSION, so the persisted flag must not win.
    expect(useSessionStore.getState().hasAcceptedTerms).toBe(false);
  });
});
