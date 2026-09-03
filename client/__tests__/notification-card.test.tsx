import { renderWithAct } from "./helpers/renderWithAct";
import NotificationCard from "../components/cards/Notification";

/**
 * `cards/Notification.tsx` transitively imports `stores/session` -> `stores/theme` (AsyncStorage)
 * via `expo-router`'s `useRouter`-adjacent chain, and `api/loop` -> `@/demo` (see
 * `session-store.test.ts` for the same pre-existing resolution gap). Stubbed here for the same
 * reason; `jest.mock()` factories may only reference out-of-scope variables named `mock*`.
 */
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/demo", () => ({
  enableDemoMode: jest.fn(),
  disableDemoMode: jest.fn(),
  demoAdapter: jest.fn(),
  DEMO_READ_ONLY_ERROR_CODE: "DEMO_READ_ONLY",
}));

const BASE = {
  id: "notification-1",
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  isRead: false,
  readAt: null,
};

const FALLBACK_TEXT = "Este contenido ya no está disponible";

describe("NotificationCard -- dangling references render a fallback instead of throwing", () => {
  // The exact 2026-09-03 production incident: a `loop` notification whose listing had already
  // been deleted reached this card with `payload.listing: null` and blanked the whole route.
  it("a loop notification with a deleted listing renders the fallback", async () => {
    const notification = {
      ...BASE,
      type: "loop",
      payload: { type: "listing_sold", listing: null },
    } as unknown as AppNotification;

    const tree = await renderWithAct(<NotificationCard notification={notification} />);

    expect(JSON.stringify(tree.toJSON())).toContain(FALLBACK_TEXT);
  });

  it("a donation notification with a deleted donor renders the fallback", async () => {
    const notification = {
      ...BASE,
      type: "donation",
      payload: { amount: 10, donorUser: null },
    } as unknown as AppNotification;

    const tree = await renderWithAct(<NotificationCard notification={notification} />);

    expect(JSON.stringify(tree.toJSON())).toContain(FALLBACK_TEXT);
  });

  it("a mission notification with a deleted mission renders the fallback", async () => {
    const notification = {
      ...BASE,
      type: "mission",
      payload: { userMission: null },
    } as unknown as AppNotification;

    const tree = await renderWithAct(<NotificationCard notification={notification} />);

    expect(JSON.stringify(tree.toJSON())).toContain(FALLBACK_TEXT);
  });
});

describe("NotificationCard -- unrecognized payload shapes render nothing instead of throwing", () => {
  it("an unknown notification type does not throw", async () => {
    const notification = {
      ...BASE,
      type: "unknown-type",
      payload: {},
    } as unknown as AppNotification;

    const tree = await renderWithAct(<NotificationCard notification={notification} />);

    // The switch's `default: return null` path -- no fallback copy is defined for it, only the
    // guarantee that rendering does not throw. The outer card shell (date badge) still commits.
    expect(tree.toJSON()).not.toBeNull();
    expect(JSON.stringify(tree.toJSON())).not.toContain(FALLBACK_TEXT);
  });

  it("an admin action other than credits does not throw", async () => {
    const notification = {
      ...BASE,
      type: "admin",
      payload: { action: "delete" },
    } as unknown as AppNotification;

    const tree = await renderWithAct(<NotificationCard notification={notification} />);

    expect(tree.toJSON()).not.toBeNull();
    expect(JSON.stringify(tree.toJSON())).not.toContain(FALLBACK_TEXT);
  });
});
