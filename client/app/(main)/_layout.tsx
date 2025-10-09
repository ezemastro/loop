import { Stack } from "expo-router";
import Header from "@/components/header/Header";
import { View } from "react-native";
import * as Notifications from "expo-notifications";
import { NotificationProvider } from "@/contexts/notification";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
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
