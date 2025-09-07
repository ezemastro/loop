import { View, Text, Image } from "react-native";
import React from "react";

export default function UserBadge({ user }: { user: PublicUser }) {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={{ uri: user.profileMedia?.url }}
        className="size-6 rounded-full bg-background"
      />
      <Text className="text-sm text-secondary-text">
        {user.firstName} {user.lastName}
      </Text>
    </View>
  );
}
