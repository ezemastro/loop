import { useAuth } from "@/hooks/useAuth";
import { View, Text } from "react-native";

export default function ChatHourLabel({
  date,
  senderId,
}: {
  date: Date;
  senderId: string;
}) {
  date = new Date(date);
  const { user } = useAuth();
  const isSender = senderId === user?.id;
  return (
    <View
      className={(isSender ? "items-end" : "items-start") + " px-3 py-1 pb-2"}
    >
      <Text className="text-secondary-text text-sm">
        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );
}
