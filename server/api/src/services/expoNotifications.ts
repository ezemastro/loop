import { Expo } from "expo-server-sdk";

const expo = new Expo();

export const sendPushNotification = async ({
  notificationToken,
  title,
  body,
  categoryId,
}: {
  notificationToken: string;
  title: string;
  body: string;
  categoryId?: string;
}) => {
  if (!Expo.isExpoPushToken(notificationToken)) {
    console.error(
      `Push token ${notificationToken} is not a valid Expo push token`,
    );
    return;
  }
  expo.sendPushNotificationsAsync([
    {
      to: notificationToken,
      title,
      body,
      categoryId,
    },
  ]);
};
