import { View, Text } from "react-native";
import React from "react";
import { PRODUCT_STATUSES, STATUS_TRANSLATIONS } from "@/config";
import { twMerge } from "tailwind-merge";

export default function ProductStatusBadge({
  status,
  containerClassName,
  textClassName,
}: {
  status: ProductStatus;
  containerClassName?: string;
  textClassName?: string;
}) {
  const getBackgroundColor = () => {
    switch (status) {
      case PRODUCT_STATUSES.NEW:
        return "bg-blue-500";
      case PRODUCT_STATUSES.LIKE_NEW:
        return "bg-teal-500";
      case PRODUCT_STATUSES.VERY_GOOD:
        return "bg-green-500";
      case PRODUCT_STATUSES.GOOD:
        return "bg-lime-500";
      case PRODUCT_STATUSES.FAIR:
        return "bg-yellow-500";
    }
  };
  return (
    <View
      className={twMerge(
        `px-2.5 py-0.5 rounded-full ${getBackgroundColor()}`,
        containerClassName,
      )}
    >
      <Text className={twMerge(`text-white font-medium`, textClassName)}>
        {STATUS_TRANSLATIONS[status]}
      </Text>
    </View>
  );
}
