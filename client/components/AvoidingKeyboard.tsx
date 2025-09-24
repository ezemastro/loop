import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { Keyboard, KeyboardAvoidingView, Platform } from "react-native";

export default function AvoidingKeyboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const keyboardHeight = Keyboard.metrics()?.height;
  const { visible } = useHideOnKeyboard();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
      style={{
        paddingBottom: !visible && Platform.OS !== "ios" ? keyboardHeight : 0,
      }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
