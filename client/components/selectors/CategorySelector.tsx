import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Category from "../cards/Category";
import CategorySelectorModal from "../modals/CategorySelectorModal";

export default function CategorySelector({
  onChange,
  value,
}: {
  onChange?: (category: Category) => void;
  value: Category | null;
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
        className="bg-white rounded border border-stroke"
      >
        {value ? (
          <Category category={value} extended />
        ) : (
          <View className="h-16 justify-center items-center">
            <Text className="text-secondary-text text-lg">
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
