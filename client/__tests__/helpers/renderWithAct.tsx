import { act, type ReactElement } from "react";
import renderer, { type ReactTestRenderer } from "react-test-renderer";

/**
 * React 19 defers the initial commit: a `renderer.create` call made outside `act()` leaves the
 * tree uncommitted, so `toJSON()` returns `null` (client-render-regression-tests spec, "Render
 * Tests Wrap `renderer.create` In `act()`"). `act` is imported from `react`, not
 * `react-test-renderer` -- the React 19 entry point, which also sidesteps the
 * `react-test-renderer@19.0.0` / `react@19.1.0` peer-version skew (CLI-10). The async form flushes
 * any pending effects too.
 */
export async function renderWithAct(element: ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(element);
  });
  return tree;
}

/**
 * React logs a boundary-caught render error through `console.error`. Scoped per test and restored
 * afterward, so a test that deliberately throws does not pollute the run's output.
 */
export function silenceRenderErrors(): () => void {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  return () => spy.mockRestore();
}
