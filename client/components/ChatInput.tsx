import { useState, useRef } from "react";
import { View, TextInput, Pressable, Platform, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { SendIcon } from "./Icons";

export default function ChatInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [messageText, setMessageText] = useState("");
  const enterPressedRef = useRef(false);

  const handleSend = () => {
    if (!messageText.trim()) return;
    onSubmit(messageText);
    setMessageText("");
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== "web") return;
    const key = e.nativeEvent.key;
    enterPressedRef.current = key === "Enter" && !(e.nativeEvent as any).shiftKey;
  };

  const handleChangeText = (text: string) => {
    if (Platform.OS === "web" && text.endsWith("\n") && enterPressedRef.current) {
      enterPressedRef.current = false;
      const trimmed = text.trim();
      if (trimmed) {
        onSubmit(trimmed);
      }
      setMessageText("");
      return;
    }
    setMessageText(text);
  };

  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        placeholder="Mensaje..."
        className="border border-stroke rounded-2xl px-4 py-2 text-main-text flex-grow text-lg"
        multiline
        numberOfLines={Platform.OS === "web" ? undefined : 4}
        style={
          Platform.OS === "web"
            ? { maxHeight: 120, minHeight: 40, outline: "none" as any }
            : undefined
        }
        value={messageText}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onSubmitEditing={Platform.OS !== "web" ? handleSend : undefined}
        blurOnSubmit={Platform.OS !== "web" ? false : undefined}
        returnKeyType="send"
      />
      <Pressable className="p-3 bg-tertiary rounded-full" onPress={handleSend}>
        <SendIcon className="text-white" size={20} />
      </Pressable>
    </View>
  );
}
