import { formatNumber } from "@/utils/formatNumber";
import { View, Text } from "react-native";
import { twMerge } from "tailwind-merge";

export default function Stat({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={twMerge(
        "px-2 py-4 gap-1 bg-white border border-stroke rounded-lg items-center flex-1 max-w-[31%]",
        className,
      )}
    >
      {icon}
      <Text className="text-2xl text-main-text font-bold mt-2">
        {formatNumber(value)}
      </Text>
      <View className="items-center justify-center flex-grow">
        <Text className="text-main-text/90 text-sm text-center font-normal">
          {label}
        </Text>
      </View>
    </View>
  );
}
