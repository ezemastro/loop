import { View } from "react-native";
import { NotificationIcon } from "../Icons";
import PendingCount from "./PendingCount";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

export default function Notifications() {
  const { data } = useUnreadNotifications();
  const unreadCount = data?.unreadNotificationsCount || 0;
  return (
    <View className="h-11 w-11 items-center justify-center">
      <NotificationIcon size={24} className="text-main-text" />
      {unreadCount > 0 && <PendingCount count={unreadCount} />}
    </View>
  );
}
