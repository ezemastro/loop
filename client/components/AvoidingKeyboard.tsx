import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";
import { twMerge } from "tailwind-merge";

export default function AvoidingKeyboard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const keyboardHeight = Keyboard.metrics()?.height;
  const { visible } = useHideOnKeyboard();
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        className={twMerge("flex-1", className)}
        keyboardVerticalOffset={170}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View
      className={twMerge("flex-1", className)}
      style={{
        paddingBottom: !visible ? (keyboardHeight || 0) + 10 : 0,
      }}
    >
      {children}
    </View>
  );
}
