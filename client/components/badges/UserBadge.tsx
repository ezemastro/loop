import { View, Text, Image } from "react-native";
import React from "react";
import { getProfileImageSource } from "@/services/getUrl";
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
    <View className={twMerge(`flex-row items-center gap-2`, containerClassName)}>
      <Image
        source={getProfileImageSource(user.profileMedia?.url)}
        className={twMerge(`rounded-full bg-background size-6`, imageClassName)}
      />
      <Text numberOfLines={1} className={twMerge(`text-secondary-text text-sm`, textClassName)}>
        {user.firstName} {user.lastName}
      </Text>
    </View>
  );
}
