import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { twMerge } from "tailwind-merge";

export default function AvoidingKeyboard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // Evitar ScrollView interno para no anidar FlatList/SectionList dentro de un scroll vertical.
  if (Platform.OS === "web") {
    return (
      <View
        className={twMerge("flex-1", className)}
        style={{
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <View
        className={twMerge("flex-1", className)}
        style={{
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
