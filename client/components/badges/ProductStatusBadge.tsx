import { View, Text } from "react-native";
import React from "react";

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
      case "new":
        return "bg-green-500";
      case "used":
        return "bg-yellow-500";
      case "repaired":
        return "bg-blue-500";
      case "damaged":
        return "bg-gray-500";
    }
  };
  const STATUS_TRANSLATIONS: Record<ProductStatus, string> = {
    new: "Nuevo",
    used: "Usado",
    repaired: "Reparado",
    damaged: "Dañado",
  };
  return (
    <View
      className={`px-2.5 py-0.5 rounded-full ${getBackgroundColor()} ${containerClassName}`}
    >
      <Text className={`text-white font-medium ${textClassName}`}>
        {STATUS_TRANSLATIONS[status]}
      </Text>
    </View>
  );
}
