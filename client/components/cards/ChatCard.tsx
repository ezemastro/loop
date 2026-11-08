import { View, Text, Pressable, Image } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { getProfileImageSource } from "@/services/getUrl";
import SchoolLogo from "../SchoolLogo";
import { listRowClassName, type RowPosition } from "../bases/listRow";

export default function ChatCard({
  chat,
  position = "only",
}: {
  chat: UserMessage;
  position?: RowPosition;
}) {
  const router = useRouter();
  const isUnread = chat.pendingMessages > 0;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        router.push({
          pathname: "/messages/[userId]",
          params: { userId: chat.userId },
        });
      }}
      className={listRowClassName(
        position,
        "min-h-[68px] flex-row items-center gap-3 px-4 py-3 web:cursor-pointer hover:bg-background",
      )}
    >
      <Image
        source={getProfileImageSource(chat.user.profileMedia?.url)}
        className="rounded-full bg-background"
        style={{ width: 44, height: 44 }}
      />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={"shrink text-base text-main-text" + (isUnread ? " font-semibold" : "")}
          >
            {chat.user.firstName} {chat.user.lastName}
          </Text>
          <View className="flex-row items-center gap-1">
            {chat.user.schools.map((s) => (
              <SchoolLogo key={s.id} school={s} size={16} className="rounded-full bg-background" />
            ))}
          </View>
        </View>
        <Text
          numberOfLines={1}
          className={"text-sm " + (isUnread ? "text-main-text" : "text-secondary-text")}
        >
          {chat.lastMessage.text.replace(/[\r\n]+/g, " ")}
        </Text>
      </View>
      {isUnread && (
        <View className="h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5">
          <Text className="text-center text-xs font-bold text-white">{chat.pendingMessages}</Text>
        </View>
      )}
    </Pressable>
  );
}
