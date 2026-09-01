import { View, Text, Image } from "react-native";
import React from "react";
import { getProfileImageSource } from "@/services/getUrl";
import { twMerge } from "tailwind-merge";

export default function UserBadge({
  user,
  textClassName,
  imageClassName,
  containerClassName,
  imageSize = 24,
}: {
  user: PublicUser;
  textClassName?: string;
  imageClassName?: string;
  containerClassName?: string;
  /**
   * Avatar edge length in px. Deliberately a number applied as an inline `style`, not a class:
   * width/height utilities do not resolve on this `Image`, so a class-only size leaves it
   * unconstrained and it renders at the source file's intrinsic size (the default avatar is
   * 640x640, which swallows whatever lays it out). `imageClassName` still styles everything else.
   */
  imageSize?: number;
}) {
  return (
    <View className={twMerge(`flex-row items-center gap-2`, containerClassName)}>
      <Image
        source={getProfileImageSource(user.profileMedia?.url)}
        style={{ width: imageSize, height: imageSize }}
        className={twMerge(`rounded-full bg-background`, imageClassName)}
      />
      <Text numberOfLines={1} className={twMerge(`text-secondary-text text-sm`, textClassName)}>
        {user.firstName} {user.lastName}
      </Text>
    </View>
  );
}
