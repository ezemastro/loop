import { View, Text } from "react-native";
import { CreditIcon } from "../Icons";

export default function CreditsBadge({ credits }: { credits: number }) {
  const formatNumber = (num: number) => {
    return num.toLocaleString("es-AR");
  };
  return (
    <View className="flex-row items-center justify-center gap-2 bg-background px-2.5 py-0.5 rounded-full">
      <CreditIcon />
      <Text className="text-sm font-medium text-credits">
        {formatNumber(credits)}
      </Text>
    </View>
  );
}
