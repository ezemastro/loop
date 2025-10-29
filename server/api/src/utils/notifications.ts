import { NOTIFICATION_TEXTS, NOTIFICATIONS_CATEGORIES } from "../config";
import { sendPushNotification } from "../services/expoNotifications";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";

const sendNotification = sendPushNotification;

interface NotificationBase {
  client: DatabaseClient;
  userId: UUID;
  notificationToken: string | null;
  disablePush?: boolean;
}

export const sendMissionNotification = async ({
  client,
  userId,
  missionId,
  notificationToken,
  disablePush,
}: NotificationBase & {
  missionId: MissionNotificationPayloadBase["userMissionId"];
}) => {
  const payload: MissionNotificationPayloadBase = {
    userMissionId: missionId,
  };
  await client.query(queries.createNotification, [
    userId,
    "mission" as NotificationType,
    payload,
  ]);
  if (!notificationToken || disablePush) return;
  await sendNotification({
    notificationToken,
    title: NOTIFICATION_TEXTS.MISSION_NOTIFICATION.COMPLETED.title,
    body: NOTIFICATION_TEXTS.MISSION_NOTIFICATION.COMPLETED.body,
    categoryId: NOTIFICATIONS_CATEGORIES.MISSION,
  });
};
export const sendLoopNotification = async ({
  client,
  userId,
  buyerId,
  listingId,
  toListingStatus,
  toOfferedCredits,
  type,
  notificationToken,
  disablePush,
}: NotificationBase & {
  buyerId: LoopNotificationPayloadBase["buyerId"];
  listingId: LoopNotificationPayloadBase["listingId"];
  toListingStatus: LoopNotificationPayloadBase["toListingStatus"];
  toOfferedCredits: LoopNotificationPayloadBase["toOfferedCredits"];
  type: LoopNotificationPayloadBase["type"];
}) => {
  const payload: LoopNotificationPayloadBase = {
    buyerId,
    listingId,
    toListingStatus,
    toOfferedCredits,
    type,
  };
  await client.query(queries.createNotification, [
    userId,
    "loop" as NotificationType,
    payload,
  ]);
  if (!notificationToken || disablePush) return;
  await sendNotification({
    notificationToken,
    title: NOTIFICATION_TEXTS.LOOP_NOTIFICATION[type].title,
    body: NOTIFICATION_TEXTS.LOOP_NOTIFICATION[type].body,
    categoryId: NOTIFICATIONS_CATEGORIES.LOOP,
  });
};
export const sendDonationNotification = async ({
  client,
  userId,
  amount,
  donorUserId,
  message,
  notificationToken,
  disablePush,
}: NotificationBase & {
  amount: DonationNotificationPayloadBase["amount"];
  donorUserId: DonationNotificationPayloadBase["donorUserId"];
  message: DonationNotificationPayloadBase["message"];
}) => {
  const payload: DonationNotificationPayloadBase = {
    amount,
    donorUserId,
    message,
  };
  await client.query(queries.createNotification, [
    userId,
    "donation" as NotificationType,
    payload,
  ]);
  if (!notificationToken || disablePush) return;
  await sendNotification({
    notificationToken,
    title: NOTIFICATION_TEXTS.DONATION_NOTIFICATION.RECEIVED.title,
    body: NOTIFICATION_TEXTS.DONATION_NOTIFICATION.RECEIVED.body,
    categoryId: NOTIFICATIONS_CATEGORIES.DONATION,
  });
};
export const sendAdminNotification = async ({
  client,
  userId,
  action,
  amount,
  message,
  referenceId,
  target,
  notificationToken,
  disablePush,
}: NotificationBase & {
  action: AdminNotificationPayloadBase["action"];
  amount: AdminNotificationPayloadBase["amount"];
  message: AdminNotificationPayloadBase["message"];
  referenceId: AdminNotificationPayloadBase["referenceId"];
  target: AdminNotificationPayloadBase["target"];
}) => {
  const payload: AdminNotificationPayloadBase = {
    action,
    amount,
    message,
    referenceId,
    target,
  };
  await client.query(queries.createNotification, [
    userId,
    "admin" as NotificationType,
    payload,
  ]);
  if (!notificationToken || disablePush) return;
  await sendNotification({
    notificationToken,
    title: "Notificación del equipo de Loop",
    body: message || "Tienes una nueva notificación del equipo de Loop",
    categoryId: NOTIFICATIONS_CATEGORIES.ADMIN,
  });
};

export const sendMessageNotification = async ({
  senderName,
  message,
  notificationToken,
}: NotificationBase & {
  senderName: string;
  message: string;
}) => {
  if (!notificationToken) return;
  await sendNotification({
    notificationToken,
    title: "Mensaje de " + senderName,
    body: message.slice(0, 100),
    categoryId: NOTIFICATIONS_CATEGORIES.MESSAGE,
  });
};
