import { useState } from "react";
import { View, TextInput, Pressable } from "react-native";
import { SendIcon } from "./Icons";

export default function ChatInput({
  onSubmit,
}: {
  onSubmit: (text: string) => void;
}) {
  const [messageText, setMessageText] = useState("");

  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        placeholder="Mensaje..."
        className="border border-stroke rounded-2xl px-4 py-2 text-main-text flex-grow text-lg"
        multiline
        numberOfLines={4}
        value={messageText}
        onChangeText={setMessageText}
      />
      <Pressable
        className="p-3 bg-tertiary rounded-full"
        onPress={() => {
          onSubmit(messageText);
          setMessageText("");
        }}
      >
        <SendIcon className="text-white" size={20} />
      </Pressable>
    </View>
  );
}
