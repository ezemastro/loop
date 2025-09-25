import { View, Text } from "react-native";
import { CreditIcon } from "../Icons";
import { twMerge } from "tailwind-merge";
import { formatNumber } from "@/utils/formatNumber";

export default function CreditsBadge({
  credits,
  containerClassName,
  numberClassName,
  iconSize,
  vertical = false,
}: {
  credits: number;
  containerClassName?: string;
  numberClassName?: string;
  iconSize?: number;
  vertical?: boolean;
}) {
  return (
    <View
      className={twMerge(
        `items-center justify-center gap-2 px-2.5 py-0.5 rounded-full` +
          (vertical ? " flex-col" : " flex-row"),
        containerClassName,
      )}
    >
      <CreditIcon size={iconSize} />
      <Text
        className={twMerge(`text-md font-medium text-credits`, numberClassName)}
      >
        {formatNumber(credits)}
      </Text>
    </View>
  );
}
