import { View, Text } from "react-native";
import { twMerge } from "tailwind-merge";

export default function Error({
  children,
  className,
  textClassName,
}: {
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
}) {
  return (
    <View className={twMerge("items-center justify-center", className)}>
      <Text className={twMerge("text-main-text", textClassName)}>
        {children}
      </Text>
    </View>
  );
}
