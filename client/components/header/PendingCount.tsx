import { View, Text } from "react-native";

/** Count badge: `primary` is reserved for these. Position it inside a 44px icon box. */
export default function PendingCount({ count }: { count: number }) {
  return (
    <View className="absolute right-0.5 top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1">
      <Text className="text-xs font-semibold text-white">{count > 99 ? "99+" : count}</Text>
    </View>
  );
}
