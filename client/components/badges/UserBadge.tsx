import { View, Text, Image } from "react-native";
import React from "react";
import { getUrl } from "@/services/getUrl";
import { twMerge } from "tailwind-merge";

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
    <View
      className={twMerge(`flex-row items-center gap-2`, containerClassName)}
    >
      <Image
        source={{ uri: getUrl(user.profileMedia?.url || "") }}
        className={twMerge(`size-6 rounded-full bg-background`, imageClassName)}
      />
      <Text className={twMerge(`text-secondary-text text-sm`, textClassName)}>
        {user.firstName} {user.lastName}
      </Text>
    </View>
  );
}
