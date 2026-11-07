import { useWishes } from "@/hooks/useWishes";
import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

/** Whether the user has a wish for this category (cards show a quiet "En tus deseados" chip). */
export function useIsCategoryWished(categoryId: string | undefined): boolean {
  const { data } = useWishes();
  return (data?.userWishes ?? []).some((wish) => wish.categoryId === categoryId);
}

/** Category path in a neutral colour. Wishlist membership is shown by the card, not by tinting. */
export default function CategoryBadge({
  category,
  className,
  numberOfLines,
}: {
  category: Category;
  className?: string;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} className={twMerge("text-secondary-text", className)}>
      {category.parents && category.parents?.map((parent) => parent.name).join(" / ") + " / "}
      {category.name}
    </Text>
  );
}
