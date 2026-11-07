import { View, Text } from "react-native";
import React from "react";

export default function Category({
  category,
  extended,
}: {
  category: Category;
  extended?: boolean;
}) {
  return (
    <View className="w-full border-b border-stroke px-1 py-3.5">
      <Text className="text-left text-base text-main-text">
        {extended &&
          category.parents &&
          category.parents.map((parent) => parent.name).join("/") + "/"}
        {category.name}
      </Text>
    </View>
  );
}
