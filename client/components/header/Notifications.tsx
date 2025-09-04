import { View } from "react-native";
import { NotificationIcon } from "../Icons";
import PendingCount from "./PendingCount";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

export default function Notifications() {
  const { data } = useUnreadNotifications();
  const unreadCount = data?.unreadNotificationsCount || 0;
  return (
    <View className="">
      <NotificationIcon size={28} className="text-white" />
      {unreadCount > 0 && <PendingCount count={unreadCount} />}
    </View>
  );
}
