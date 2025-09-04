import { View, Text } from "react-native";

export default function PendingCount({ count }: { count: number }) {
  return (
    <View className="absolute -bottom-0.5 -right-2 bg-primary size-5 rounded-full justify-center items-center">
      <Text className="text-white font-medium text-sm">{count}</Text>
    </View>
  );
}
