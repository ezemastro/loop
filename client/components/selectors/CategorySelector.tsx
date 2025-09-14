import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Category from "../cards/Category";
import CategorySelectorModal from "../modals/CategorySelectorModal";
import { twMerge } from "tailwind-merge";

export default function CategorySelector({
  onChange,
  value,
  className,
  placeholderClassName,
}: {
  onChange?: (category: Category) => void;
  value: Category | null;
  className?: string;
  placeholderClassName?: string;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (category: Category) => {
    onChange?.(category);
    closeModal();
  };

  return (
    <View>
      <Pressable
        onPress={openModal}
        className={twMerge("bg-white rounded border border-stroke", className)}
      >
        {value ? (
          <Category category={value} extended />
        ) : (
          <View className="h-16 justify-center items-center">
            <Text
              className={twMerge(
                "text-secondary-text text-lg",
                placeholderClassName,
              )}
            >
              Seleccionar categoría
            </Text>
          </View>
        )}
      </Pressable>
      <CategorySelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        onClose={closeModal}
      />
    </View>
  );
}
