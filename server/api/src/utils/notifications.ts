import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";

const sendNotification = async () => {
  // Lógica para enviar la notificación (por ejemplo, a través de un servicio de terceros)
};

export const sendMissionNotification = async ({
  client,
  userId,
  missionId,
}: {
  client: DatabaseClient;
  userId: string;
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
  await sendNotification();
};
export const sendLoopNotification = async ({
  client,
  userId,
  buyerId,
  listingId,
  toListingStatus,
  toOfferedCredits,
}: {
  client: DatabaseClient;
  userId: string;
  buyerId: LoopNotificationPayloadBase["buyerId"];
  listingId: LoopNotificationPayloadBase["listingId"];
  toListingStatus: LoopNotificationPayloadBase["toListingStatus"];
  toOfferedCredits: LoopNotificationPayloadBase["toOfferedCredits"];
}) => {
  const payload: LoopNotificationPayloadBase = {
    buyerId,
    listingId,
    toListingStatus,
    toOfferedCredits,
  };
  await client.query(queries.createNotification, [
    userId,
    "loop" as NotificationType,
    payload,
  ]);
  await sendNotification();
};
export const sendDonationNotification = async ({
  client,
  userId,
  amount,
  donorUserId,
  message,
}: {
  client: DatabaseClient;
  userId: string;
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
  await sendNotification();
};
export const sendAdminNotification = async ({
  client,
  userId,
  action,
  amount,
  message,
  referenceId,
  target,
}: {
  client: DatabaseClient;
  userId: string;
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
  await sendNotification();
};
// export const sendMessageNotification = async ({
//   userId,
//   message,
// }: {
//   userId: string;
//   message: string;
// }) => {
//   await sendNotification();
// };
