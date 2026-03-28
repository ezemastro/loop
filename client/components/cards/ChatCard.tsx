import { View, Text, Pressable, Image } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { getUrl } from "@/services/getUrl";

export default function ChatCard({ chat }: { chat: UserMessage }) {
  const router = useRouter();

  const lastMessageShortText = (text: string) => {
    const singleLineText = text.replace(/[\r\n]+/g, " ");
    return singleLineText.length > 30
      ? singleLineText.slice(0, 30) + "..."
      : singleLineText;
  };
  return (
    <Pressable
      onPress={() => {
        router.push({
          pathname: "/messages/[userId]",
          params: { userId: chat.userId },
        });
      }}
      className="flex-row p-3 gap-4 bg-white rounded-xl shadow items-center"
    >
      <Image
        source={{ uri: getUrl(chat.user.profileMedia?.url || "") }}
        className="bg-background rounded-full"
        style={{ width: 64, height: 64 }}
      />
      <View>
        <View className="flex-row items-center gap-2">
          <Text
            className={
              "text-main-text text-lg" +
              (chat.pendingMessages > 0 ? " font-bold" : "")
            }
          >
            {chat.user.firstName} {chat.user.lastName}
          </Text>
          <View className="flex-row items-center">
            {chat.user.schools.map((s) => (
              <Image
                key={s.id}
                source={{ uri: getUrl(s.media.url) }}
                className="rounded-full bg-background mx-0.5"
                style={{ width: 24, height: 24 }}
              />
            ))}
          </View>
        </View>
        <Text className="text-secondary-text">
          {lastMessageShortText(chat.lastMessage.text)}
        </Text>
      </View>
      <View className="flex-1 items-end px-3">
        {chat.pendingMessages > 0 && (
          <View className="bg-primary size-9 rounded-full items-center justify-center">
            <Text className="text-white font-bold text-center text-lg">
              {chat.pendingMessages}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
