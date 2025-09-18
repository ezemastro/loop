import { View, Text } from "react-native";

export default function Error({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`items-center justify-center ${className}`}>
      <Text className="text-main-text">{children}</Text>
    </View>
  );
}
