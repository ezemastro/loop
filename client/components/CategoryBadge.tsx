import { useWishes } from "@/hooks/useWishes";
import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

export default function CategoryBadge({
  category,
  className,
  colorless,
  numberOfLines,
}: {
  category: Category;
  className?: string;
  colorless?: boolean;
  numberOfLines?: number;
}) {
  const { data } = useWishes();
  const wishedCategories = data?.userWishes || [];
  const isWished = wishedCategories.some((wish) => wish.categoryId === category.id);
  return (
    <Text
      numberOfLines={numberOfLines}
      className={twMerge(
        "text-secondary-text",
        isWished && colorless !== true && "text-secondary",
        className,
      )}
    >
      {category.parents && category.parents?.map((parent) => parent.name).join(" / ") + " / "}
      {category.name}
    </Text>
  );
}
