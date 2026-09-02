/**
 * Where a notification card (or, once the payload has data, a push tap) should navigate. A pure
 * function of the notification so it is unit-testable without rendering — see design D6.
 */
export type NotificationDestination =
  | { pathname: "/(main)/listing/[listingId]"; params: { listingId: string } }
  | { pathname: "/(main)/user/[userId]"; params: { userId: string } };

/**
 * `null` means "no detail route exists for this notification" — the card must not be pressable
 * and no navigation must be attempted. `mission` always resolves to `null`: there is no mission
 * detail screen.
 */
export function notificationRoute(notification: AppNotification): NotificationDestination | null {
  switch (notification.type) {
    case "loop": {
      const { listingId } = notification.payload as LoopNotificationPayloadBase;
      if (!listingId) return null;
      return { pathname: "/(main)/listing/[listingId]", params: { listingId: String(listingId) } };
    }
    case "donation": {
      const { donorUserId } = notification.payload as DonationNotificationPayloadBase;
      if (!donorUserId) return null;
      return { pathname: "/(main)/user/[userId]", params: { userId: String(donorUserId) } };
    }
    case "admin": {
      const payload = notification.payload as AdminNotificationPayloadBase;
      if (payload.target === "listing" && payload.referenceId) {
        return {
          pathname: "/(main)/listing/[listingId]",
          params: { listingId: String(payload.referenceId) },
        };
      }
      return null;
    }
    case "mission":
      return null;
  }
}
