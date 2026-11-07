import { useEffect, useRef, useState } from "react";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  View,
  TextInput,
  Pressable,
  Platform,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputKeyPressEventData,
} from "react-native";
import { SendIcon } from "./Icons";
import { fieldWrapperProps } from "./bases/fieldProps";

const LINE_HEIGHT = 24;
const MAX_INPUT_HEIGHT = 100; // 100 + 2 * 10 of wrapper padding = 120

const clampHeight = (height: number) =>
  Math.min(MAX_INPUT_HEIGHT, Math.max(LINE_HEIGHT, Math.ceil(height)));

export default function ChatInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const colors = useThemeColors();
  const [messageText, setMessageText] = useState("");
  const [inputHeight, setInputHeight] = useState(LINE_HEIGHT);
  const enterPressedRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const canSend = messageText.trim().length > 0;

  // react-native-web does not size a multiline input to its content: measure the textarea itself.
  // Collapsing it first is what lets it shrink when text is deleted. Native reports the content
  // size through `onContentSizeChange` instead.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    node.style.height = "0px";
    const nextHeight = clampHeight(node.scrollHeight);
    // Set the final value here too: when the state does not change React leaves the inline style
    // alone, and clearing it would fall back to the textarea's default two rows.
    node.style.height = `${nextHeight}px`;
    setInputHeight(nextHeight);
  }, [messageText]);

  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    if (Platform.OS === "web") return;
    setInputHeight(clampHeight(e.nativeEvent.contentSize.height));
  };

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
    <View className="flex-row items-end gap-2">
      <View
        {...fieldWrapperProps}
        className="min-h-[44px] flex-1 justify-center rounded-xl border border-stroke bg-white px-3 py-[10px]"
      >
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.SECONDARY_TEXT}
          placeholder="Escribí un mensaje"
          accessibilityLabel="Mensaje"
          className="p-0 text-base text-main-text"
          multiline
          textAlignVertical="center"
          // Focus ring comes from the wrapper (`fieldWrapperProps`) via `global.css`.
          style={{ height: inputHeight, lineHeight: LINE_HEIGHT }}
          value={messageText}
          onChangeText={handleChangeText}
          onContentSizeChange={handleContentSizeChange}
          onKeyPress={handleKeyPress}
          onSubmitEditing={Platform.OS !== "web" ? handleSend : undefined}
          blurOnSubmit={Platform.OS !== "web" ? false : undefined}
          returnKeyType="send"
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={handleSend}
        className={
          "h-11 w-11 items-center justify-center rounded-full bg-accent web:cursor-pointer " +
          (canSend ? "active:opacity-80" : "opacity-40 web:cursor-default")
        }
      >
        <SendIcon className="text-white" size={20} />
      </Pressable>
    </View>
  );
}
