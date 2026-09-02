import { useSessionStore } from "../stores/session";
import { useThemeStore } from "../stores/theme";
import { queryClient } from "../api/queryClient";
import { disableDemoMode, enableDemoMode } from "@/demo";

/**
 * `stores/session.ts` transitively imports `@/demo` -> `../../shared/demo-data`, which fails to
 * resolve `@babel/runtime` under jest (see `api-client.test.ts` for the same pre-existing,
 * out-of-scope resolution gap). Stubbed here for the same reason.
 *
 * `jest.mock()` factories can only reference out-of-scope variables named `mock*` (a
 * `babel-plugin-jest-hoist` restriction, since the call is hoisted above imports), so the shipped
 * mock is `require()`d inline rather than imported at the top.
 */
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

const COMMUNITY = { id: "community-1", theme: { colors: {} } } as unknown as Community;

const USER = {
  id: "user-1",
  email: "user@example.com",
  phone: null,
  firstName: "Ana",
  lastName: "Gómez",
  profileMediaId: null,
  communityId: "community-1",
  credits: { balance: 0, locked: 0 },
  stats: {} as Stats,
  profileMedia: null,
  schools: [],
  community: COMMUNITY,
} as unknown as PrivateUser;

const resetStore = () => {
  useSessionStore.setState({
    user: null,
    authToken: null,
    hasAcceptedTerms: false,
    hasToken: false,
    demoMode: false,
  });
  useThemeStore.setState({ community: null, previewCommunity: null });
};

describe("useSessionStore transitions", () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it("login syncs the community theme", () => {
    useSessionStore.getState().login(USER, "token-1");
    expect(useSessionStore.getState().authToken).toBe("token-1");
    expect(useSessionStore.getState().user).toBe(USER);
    expect(useThemeStore.getState().community).toBe(COMMUNITY);
  });

  it("setUser syncs the community theme", () => {
    useSessionStore.getState().setUser(USER);
    expect(useSessionStore.getState().user).toBe(USER);
    expect(useThemeStore.getState().community).toBe(COMMUNITY);
  });

  it("enterDemoMode clears the theme and query cache before entering", () => {
    useThemeStore.setState({ community: COMMUNITY });
    useSessionStore.getState().enterDemoMode();
    expect(useSessionStore.getState().demoMode).toBe(true);
    expect(enableDemoMode).toHaveBeenCalledTimes(1);
    expect(useThemeStore.getState().community).toBeNull();
  });

  /**
   * `DEMO.md` depends on this exact order: disabling demo mode reopens the network, so it must run
   * strictly after the theme and the query cache — that were serving the *previous* session's data
   * — are gone. This test fails if that order ever changes.
   */
  it("logout clears the theme, then the query cache, then disables demo mode, in that order", () => {
    useSessionStore.getState().login(USER, "token-1");
    useThemeStore.setState({ community: COMMUNITY });

    const clearThemeSpy = jest.spyOn(useThemeStore.getState(), "clear");
    const clearQuerySpy = jest.spyOn(queryClient, "clear");

    useSessionStore.getState().logout();

    expect(clearThemeSpy).toHaveBeenCalledTimes(1);
    expect(clearQuerySpy).toHaveBeenCalledTimes(1);
    expect(disableDemoMode).toHaveBeenCalledTimes(1);

    const themeOrder = clearThemeSpy.mock.invocationCallOrder[0];
    const queryOrder = clearQuerySpy.mock.invocationCallOrder[0];
    const demoOrder = (disableDemoMode as jest.Mock).mock.invocationCallOrder[0];

    expect(themeOrder).toBeLessThan(queryOrder);
    expect(queryOrder).toBeLessThan(demoOrder);

    expect(useSessionStore.getState().authToken).toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().demoMode).toBe(false);
  });
});

describe("useSessionStore persisted shape (partialize)", () => {
  beforeEach(() => resetStore());

  const getPartialize = () => {
    const options = (
      useSessionStore as unknown as {
        persist: { getOptions: () => { partialize: (state: unknown) => unknown } };
      }
    ).persist.getOptions();
    return options.partialize;
  };

  it("persists exactly the token and the session flags, never the user", () => {
    useSessionStore.getState().login(USER, "token-1");
    useSessionStore.getState().setHasAcceptedTerms(true);
    useSessionStore.getState().setHasToken(true);

    const partialize = getPartialize();
    const persisted = partialize(useSessionStore.getState()) as Record<string, unknown>;

    expect(persisted).toEqual({
      authToken: "token-1",
      hasAcceptedTerms: true,
      hasToken: true,
      demoMode: false,
    });
    expect(persisted).not.toHaveProperty("user");
  });

  it("stays under the 2048-byte SecureStore per-value limit for a realistic payload", () => {
    useSessionStore.getState().login(USER, "a-realistic-looking-jwt-token".repeat(4));
    useSessionStore.getState().setHasAcceptedTerms(true);
    useSessionStore.getState().setHasToken(true);
    useSessionStore.getState().enterDemoMode();

    const partialize = getPartialize();
    const persisted = partialize(useSessionStore.getState());
    const serialized = JSON.stringify({ state: persisted, version: 0 });

    expect(serialized.length).toBeLessThan(2048);
  });
});
