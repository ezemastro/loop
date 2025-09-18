import { ScrollView, View } from "react-native";
import { twMerge } from "tailwind-merge";
import CustomRefresh from "../CustomRefresh";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const MainView = ({
  children,
  className,
  refreshEnabled,
  safeBottom = false,
}: {
  children: React.ReactNode;
  className?: string;
  refreshEnabled?: boolean;
  safeBottom?: boolean;
}) => {
  const insets = useSafeAreaInsets();
  if (refreshEnabled) {
    return (
      <View
        className={twMerge("flex-1", className)}
        style={safeBottom ? { paddingBottom: insets.bottom } : {}}
      >
        <ScrollView refreshControl={<CustomRefresh />}>{children}</ScrollView>
      </View>
    );
  }
  return (
    <View
      className={twMerge("flex-1", className)}
      style={safeBottom ? { paddingBottom: insets.bottom } : {}}
    >
      {children}
    </View>
  );
};
