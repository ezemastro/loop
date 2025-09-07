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
    <View className="p-4">
      <Text className="text-main-text text-lg">
        {extended &&
          category.parents &&
          category.parents.map((parent) => parent.name).join("/") + "/"}
        {category.name}
      </Text>
    </View>
  );
}
