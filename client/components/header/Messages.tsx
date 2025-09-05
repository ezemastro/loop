import { View } from "react-native";
import { MessageIcon } from "../Icons";
import PendingCount from "./PendingCount";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export default function Messages() {
  const { data } = useUnreadMessages();
  const unreadCount = data?.unreadChatsCount || 0;
  return (
    <View>
      <MessageIcon size={28} className="text-white" />
      {unreadCount > 0 && <PendingCount count={unreadCount} />}
    </View>
  );
}
