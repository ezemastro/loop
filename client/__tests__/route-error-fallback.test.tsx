import type { ReactTestInstance } from "react-test-renderer";
import { Try } from "expo-router/build/views/Try";
import { renderWithAct, silenceRenderErrors } from "./helpers/renderWithAct";
import { TabErrorBoundary, AppErrorBoundary } from "../components/RouteErrorFallback";
import { queryClient } from "../api/queryClient";
import { reloadApp } from "../services/reloadApp";

/**
 * `Try` is the exact class `useScreens.js` installs as every route's error boundary (design.md
 * D8) -- importing it from its deep path, rather than writing a local boundary, is what makes this
 * test prove our wiring instead of just proving React works. `getDerivedStateFromError` calls
 * `SplashScreen.hideAsync()`, hence the mock below.
 */
jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn() }));

const mockRouterReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockRouterReplace }) }));
jest.mock("../services/reloadApp", () => ({ reloadApp: jest.fn().mockResolvedValue(undefined) }));

/** Always throws during render -- used to prove the boundary actually catches the throw. */
function Throws(): never {
  throw new Error("boom");
}

/**
 * NativeWind's Babel transform wraps any host component that carries a `className` prop (both
 * `Pressable`s here do) in a per-file `cssInterop` component, so the wrapped reference used inside
 * `RouteErrorFallback.tsx` is never `===` the plain `Pressable` this test file would import from
 * `react-native` -- matching by the wrapper's preserved function name is what actually works.
 * `RouteErrorFallback` renders its two actions in a fixed order (retry, then escape) regardless of
 * mode, so reading them by position is stable against copy changes too.
 */
const isPressable = (node: ReactTestInstance): boolean => {
  const type = node.type;
  if (typeof type !== "function") return false;
  const named = type as { name?: string; displayName?: string };
  return named.name === "Pressable" || named.displayName === "Pressable";
};

const getButtons = (
  tree: Awaited<ReturnType<typeof renderWithAct>>,
): [ReactTestInstance, ReactTestInstance] => {
  const buttons = tree.root.findAll(isPressable);
  return [buttons[0], buttons[1]];
};

/** `onPress` comes back as `unknown` from the hand-written test-renderer shim. */
const press = (button: ReactTestInstance) => (button.props.onPress as () => void | Promise<void>)();

describe("A boundary containment test exists", () => {
  it("a throwing child is contained instead of propagating, and the fallback renders", async () => {
    const restoreConsole = silenceRenderErrors();
    try {
      const tree = await renderWithAct(
        <Try catch={TabErrorBoundary}>
          <Throws />
        </Try>,
      );

      expect(JSON.stringify(tree.toJSON())).toContain("Algo salió mal");
    } finally {
      restoreConsole();
    }
  });
});

describe("Retry resets the whole query cache before retrying", () => {
  afterEach(() => jest.clearAllMocks());

  it("calls queryClient.resetQueries with no type filter, before the injected retry resolves", async () => {
    const order: string[] = [];
    const resetQueriesSpy = jest.spyOn(queryClient, "resetQueries").mockImplementation(() => {
      order.push("resetQueries");
      return Promise.resolve();
    });
    const retry = jest.fn(() => Promise.resolve().then(() => void order.push("retry")));

    const tree = await renderWithAct(<TabErrorBoundary error={new Error("boom")} retry={retry} />);
    const [retryButton] = getButtons(tree);

    await press(retryButton);

    expect(resetQueriesSpy).toHaveBeenCalledTimes(1);
    // Unfiltered: no `{ type: "active" }` argument (design.md D2).
    expect(resetQueriesSpy).toHaveBeenCalledWith();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["resetQueries", "retry"]);

    resetQueriesSpy.mockRestore();
  });
});

describe("Escape target per mode", () => {
  afterEach(() => jest.clearAllMocks());

  it("a tab boundary escapes to the home tab", async () => {
    const tree = await renderWithAct(
      <TabErrorBoundary error={new Error("boom")} retry={jest.fn().mockResolvedValue(undefined)} />,
    );
    const [, escapeButton] = getButtons(tree);

    press(escapeButton);

    expect(mockRouterReplace).toHaveBeenCalledWith("/(main)/(tabs)/home");
    expect(reloadApp).not.toHaveBeenCalled();
  });

  it("the app boundary escapes by reloading instead of navigating", async () => {
    const tree = await renderWithAct(
      <AppErrorBoundary error={new Error("boom")} retry={jest.fn().mockResolvedValue(undefined)} />,
    );
    const [, escapeButton] = getButtons(tree);

    press(escapeButton);

    expect(reloadApp).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
