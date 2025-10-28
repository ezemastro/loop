import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

export default function CategoryBadge({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <Text className={twMerge("text-secondary-text", className)}>
      {category.parents &&
        category.parents?.map((parent) => parent.name).join(" / ") + " / "}
      {category.name}
    </Text>
  );
}
