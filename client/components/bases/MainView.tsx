import { ScrollView, View } from "react-native";
import { twMerge } from "tailwind-merge";
import CustomRefresh from "../CustomRefresh";

export const MainView = ({
  children,
  className,
  refreshEnabled,
}: {
  children: React.ReactNode;
  className?: string;
  refreshEnabled?: boolean;
}) => {
  if (refreshEnabled) {
    return (
      <View className={twMerge("flex-1", className)}>
        <ScrollView refreshControl={<CustomRefresh />}>{children}</ScrollView>
      </View>
    );
  }
  return <View className={twMerge("flex-1", className)}>{children}</View>;
};
