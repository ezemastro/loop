import { ScrollView, View } from "react-native";
import { twMerge } from "tailwind-merge";
import CustomRefresh from "../CustomRefresh";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Single page-width cap, applied identically in both branches below (D9) so the max-width does
 * not depend on the `refreshEnabled` flag. `max-w-6xl` (1152px) below `xl`, `1400px` at `xl`+.
 */
export const PAGE_CLASS = "w-full max-w-6xl xl:max-w-[1400px] mx-auto";

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
        <ScrollView
          className="flex-1"
          contentContainerClassName={PAGE_CLASS}
          refreshControl={<CustomRefresh />}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <View
      className={twMerge("flex-1", PAGE_CLASS, className)}
      style={safeBottom ? { paddingBottom: insets.bottom } : {}}
    >
      {children}
    </View>
  );
};
