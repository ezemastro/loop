import { act } from "react";
import { renderWithAct } from "./helpers/renderWithAct";
import DemoModeBanner from "../components/DemoModeBanner";

/**
 * `marketing-landing` T7: on the embeddable live-demo route the "Modo demo" banner must stay
 * hidden until the visitor's first interaction inside the iframe, then behave exactly as it
 * always has. Everywhere else (`isEmbedRoute: false`) nothing about this component changes.
 */

const mockEmbedMode = { isEmbedRoute: false };
jest.mock("@/services/embedMode", () => ({
  __esModule: true,
  get isEmbedRoute() {
    return mockEmbedMode.isEmbedRoute;
  },
}));

const mockSessionState = { demoMode: true, logout: jest.fn() };
jest.mock("@/stores/session", () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

const BANNER_TEXT = "Modo demo: datos de ejemplo. Nada de lo que hagas se guarda.";

/**
 * The react-native jest environment's `window` stub isn't a real `EventTarget` (no
 * `addEventListener`/`dispatchEvent`) — only the real web runtime needs those, so this wires a
 * throwaway `EventTarget` behind `window` just for this suite rather than changing the component.
 */
beforeAll(() => {
  const target = new EventTarget();
  window.addEventListener = target.addEventListener.bind(target);
  window.removeEventListener = target.removeEventListener.bind(target);
  window.dispatchEvent = target.dispatchEvent.bind(target);
});

describe("DemoModeBanner outside the embed route", () => {
  beforeEach(() => {
    mockEmbedMode.isEmbedRoute = false;
  });

  it("shows immediately when demoMode is true, same as before this feature", async () => {
    const tree = await renderWithAct(<DemoModeBanner />);
    expect(JSON.stringify(tree.toJSON())).toContain(BANNER_TEXT);
  });
});

describe("DemoModeBanner on the embed route", () => {
  beforeEach(() => {
    mockEmbedMode.isEmbedRoute = true;
  });

  it("renders nothing before any interaction", async () => {
    const tree = await renderWithAct(<DemoModeBanner />);
    expect(tree.toJSON()).toBeNull();
  });

  it.each(["pointerdown", "keydown", "scroll", "touchstart"])(
    "shows the banner after a %s on window",
    async (eventType) => {
      const tree = await renderWithAct(<DemoModeBanner />);
      expect(tree.toJSON()).toBeNull();

      await act(async () => {
        window.dispatchEvent(new Event(eventType));
      });

      expect(JSON.stringify(tree.toJSON())).toContain(BANNER_TEXT);
    },
  );
});
