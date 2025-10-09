import { Platform } from "react-native";
import * as Notification from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

export const registerPushNotification = async () => {
  if (Platform.OS === "android") {
    await Notification.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notification.AndroidImportance.MAX,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notification.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notification.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      throw new Error("Failed to get push token for push notification!");
    }
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      throw new Error("EAS project ID is not defined");
    }
    try {
      const pushTokenString = (
        await Notification.getExpoPushTokenAsync({ projectId })
      ).data;
      return pushTokenString;
    } catch (error) {
      throw new Error("Error getting push token: " + error);
    }
  } else {
    throw new Error("Must use physical device for Push Notifications");
  }
};
