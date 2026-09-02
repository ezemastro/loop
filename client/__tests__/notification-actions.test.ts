import { notificationRoute } from "../services/notificationRoute";
import { missionProgressPercent } from "../utils/missionProgressPercent";

const BASE = {
  id: "notification-1",
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  isRead: false,
};

describe("notificationRoute", () => {
  it("a loop notification with a listing identifier opens the listing", () => {
    const notification = {
      ...BASE,
      type: "loop",
      payload: { listingId: "listing-1" },
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toEqual({
      pathname: "/(main)/listing/[listingId]",
      params: { listingId: "listing-1" },
    });
  });

  it("a donation notification with a donor identifier opens the donor's profile", () => {
    const notification = {
      ...BASE,
      type: "donation",
      payload: { donorUserId: "donor-1" },
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toEqual({
      pathname: "/(main)/user/[userId]",
      params: { userId: "donor-1" },
    });
  });

  it("an admin notification targeting a listing opens that listing", () => {
    const notification = {
      ...BASE,
      type: "admin",
      payload: { target: "listing", referenceId: "listing-2" },
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toEqual({
      pathname: "/(main)/listing/[listingId]",
      params: { listingId: "listing-2" },
    });
  });

  it("an admin notification not targeting a listing has no destination", () => {
    const notification = {
      ...BASE,
      type: "admin",
      payload: { target: "credits" },
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toBeNull();
  });

  it("a mission notification is never pressable — no detail route exists", () => {
    const notification = {
      ...BASE,
      type: "mission",
      payload: { userMissionId: "mission-1" },
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toBeNull();
  });

  it("a loop notification missing its listing identifier has no destination", () => {
    const notification = {
      ...BASE,
      type: "loop",
      payload: {},
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toBeNull();
  });

  it("a donation notification missing its donor identifier has no destination", () => {
    const notification = {
      ...BASE,
      type: "donation",
      payload: {},
    } as unknown as AppNotification;
    expect(notificationRoute(notification)).toBeNull();
  });
});

describe("missionProgressPercent", () => {
  it("a zero total renders an empty bar instead of NaN", () => {
    expect(missionProgressPercent(0, 0)).toBe(0);
  });

  it("a positive current over a zero total renders an empty bar instead of Infinity", () => {
    expect(missionProgressPercent(1, 0)).toBe(0);
  });

  it("three of four renders proportionally", () => {
    expect(missionProgressPercent(3, 4)).toBe(75);
  });

  it("nine of four clamps to one hundred", () => {
    expect(missionProgressPercent(9, 4)).toBe(100);
  });

  it("a negative current clamps to zero", () => {
    expect(missionProgressPercent(-1, 4)).toBe(0);
  });
});
