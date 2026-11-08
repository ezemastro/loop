import { View } from "react-native";
import { MessageIcon } from "../Icons";
import PendingCount from "./PendingCount";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export default function Messages() {
  const { data } = useUnreadMessages();
  const unreadCount = data?.unreadChatsCount || 0;
  return (
    <View className="h-11 w-11 items-center justify-center">
      <MessageIcon size={24} className="text-main-text" />
      {unreadCount > 0 && <PendingCount count={unreadCount} />}
    </View>
  );
}
