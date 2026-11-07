import { View, Text } from "react-native";
import React from "react";
import { STATUS_TRANSLATIONS } from "@/config";
import { twMerge } from "tailwind-merge";

/**
 * Quiet neutral chip: the condition is readable as text, with no colour coding (a colour per
 * condition competed with the brand colour and carried no information the word does not).
 */
export default function ProductStatusBadge({
  status,
  containerClassName,
  textClassName,
}: {
  status: ProductStatus;
  containerClassName?: string;
  textClassName?: string;
}) {
  return (
    <View className={twMerge("rounded-full bg-main-text/10 px-2.5 py-0.5", containerClassName)}>
      <Text className={twMerge("text-xs font-medium text-main-text", textClassName)}>
        {STATUS_TRANSLATIONS[status]}
      </Text>
    </View>
  );
}
