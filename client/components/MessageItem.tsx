import { useAuth } from "@/hooks/useAuth";
import { View, Text } from "react-native";

export default function MessageItem({
  message,
}: {
  message: Message & { isOptimistic?: boolean };
}) {
  const { user } = useAuth();
  const isSender = message.senderId === user?.id;
  return (
    <View className={isSender ? "items-end" : "items-start"}>
      <View
        className={
          "p-1 max-w-[80%] " +
          (isSender
            ? "border border-stroke rounded-l-2xl"
            : "bg-secondary rounded-r-2xl")
        }
      >
        <Text
          className={
            "px-2 py-1 text-lg " +
            (message.isOptimistic
              ? "text-secondary-text"
              : isSender
                ? "text-main-text"
                : "text-white")
          }
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}
