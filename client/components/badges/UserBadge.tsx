import { View, Text, Image } from "react-native";
import React from "react";

export default function UserBadge({
  user,
  textClassName,
  imageClassName,
  containerClassName,
}: {
  user: PublicUser;
  textClassName?: string;
  imageClassName?: string;
  containerClassName?: string;
}) {
  return (
    <View className={`flex-row items-center gap-2 ${containerClassName}`}>
      <Image
        source={{ uri: user.profileMedia?.url }}
        className={`size-6 rounded-full bg-background ${imageClassName}`}
      />
      <Text className={`text-sm text-secondary-text ${textClassName}`}>
        {user.firstName} {user.lastName}
      </Text>
    </View>
  );
}
