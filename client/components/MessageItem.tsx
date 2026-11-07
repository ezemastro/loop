import { View, Text } from "react-native";
import { useAuth } from "@/hooks/useAuth";

/**
 * One chat bubble. Mine are accent-filled and sit on the right; the other person's are white with
 * a hairline border on the left. `compact` groups consecutive bubbles of the same sender: the
 * gap above a bubble is 2px inside a group and 12px between senders (`startsGroup`).
 */
export default function MessageItem({
  message,
  startsGroup = false,
}: {
  message: Message & { isOptimistic?: boolean };
  startsGroup?: boolean;
}) {
  const { user } = useAuth();
  const isSender = message.senderId === user?.id;
  return (
    <View
      className={
        "px-4 " + (isSender ? "items-end " : "items-start ") + (startsGroup ? "mt-3" : "mt-0.5")
      }
    >
      <View
        className={
          "max-w-[75%] rounded-[18px] px-3 py-2 " +
          (isSender
            ? "rounded-br-[4px] bg-accent " + (message.isOptimistic ? "opacity-60" : "")
            : "rounded-bl-[4px] border border-stroke bg-white")
        }
      >
        <Text className={"text-base " + (isSender ? "text-white" : "text-main-text")}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}
