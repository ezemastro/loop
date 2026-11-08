import { useState } from "react";
import { View } from "react-native";
import CategorySelectorModal from "../modals/CategorySelectorModal";
import { ControlTrigger } from "../bases/Field";

export default function CategorySelector({
  onChange,
  value,
  invalid,
}: {
  onChange?: (category: Category) => void;
  value: Category | null;
  invalid?: boolean;
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

  const label = value
    ? [...(value.parents?.map((parent) => parent.name) ?? []), value.name].join(" / ")
    : null;

  return (
    <View>
      <ControlTrigger
        onPress={openModal}
        invalid={invalid}
        placeholder="Elegí una categoría"
        value={label}
      />
      <CategorySelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        onClose={closeModal}
      />
    </View>
  );
}
