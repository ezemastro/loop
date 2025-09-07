import { View, Text } from "react-native";

export default function CategoryBadge({ category }: { category: Category }) {
  return (
    <View>
      <Text className="text-secondary-text">
        {category.parents &&
          category.parents?.map((parent) => parent.name).join(" / ") + " / "}
        {category.name}
      </Text>
    </View>
  );
}
