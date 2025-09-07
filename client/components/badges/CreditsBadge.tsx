import { View, Text } from "react-native";
import { CreditIcon } from "../Icons";

export default function CreditsBadge({
  credits,
  containerClassName,
  numberClassName,
  iconSize,
}: {
  credits: number;
  containerClassName?: string;
  numberClassName?: string;
  iconSize?: number;
}) {
  const formatNumber = (num: number) => {
    return num.toLocaleString("es-AR");
  };
  return (
    <View
      className={`flex-row items-center justify-center gap-2 px-2.5 py-0.5 rounded-full ${containerClassName}`}
    >
      <CreditIcon size={iconSize} />
      <Text className={`text-sm font-medium text-credits ${numberClassName}`}>
        {formatNumber(credits)}
      </Text>
    </View>
  );
}
