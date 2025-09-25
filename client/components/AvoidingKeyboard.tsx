import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";

export default function AvoidingKeyboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const keyboardHeight = Keyboard.metrics()?.height;
  const { visible } = useHideOnKeyboard();
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
        keyboardVerticalOffset={170}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View
      className="flex-1"
      style={{
        paddingBottom: !visible ? keyboardHeight : 0,
      }}
    >
      {children}
    </View>
  );
}
