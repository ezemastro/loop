import { useAuth } from "@/hooks/useAuth";
import { View, Text } from "react-native";

/** Small time caption under the last bubble of a group, aligned with the bubble side. */
export default function ChatHourLabel({ date, senderId }: { date: string; senderId: string }) {
  const parsedDate = new Date(date);
  const { user } = useAuth();
  const isSender = senderId === user?.id;
  return (
    <View className={(isSender ? "items-end" : "items-start") + " px-5 pt-1"}>
      <Text className="text-xs text-secondary-text">
        {parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );
}
