import { Stack } from "expo-router";
import Header from "@/components/header/Header";
import { View } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationProvider } from "@/contexts/notification";
import { NOTIFICATIONS_CATEGORIES } from "@/config";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    return notification.request.content.categoryIdentifier ===
      NOTIFICATIONS_CATEGORIES.MESSAGE
      ? {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        }
      : {
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
  },
});

export default function MainLayout() {
  return (
    <NotificationProvider>
      <View className="flex-1 bg-white">
        <Header />
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </NotificationProvider>
  );
}
