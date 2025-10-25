import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import SchoolSelectorModal from "../modals/SchoolSelectorModal";
import School from "../cards/School";

export default function SchoolSelector({
  onChange,
  value,
  multiple = false,
}: {
  onChange?: (schools: School[]) => void;
  value: School[] | null;
  multiple?: boolean;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (schools: School[]) => {
    onChange?.(schools);
    closeModal();
  };

  return (
    <View>
      <Pressable
        onPress={openModal}
        className={
          "rounded border border-stroke gap-0.5 " +
          (value?.length && value.length > 0 ? "" : "bg-white")
        }
      >
        {value ? (
          <>
            {value.map((school) => (
              <School key={school.id} school={school} className="" />
            ))}
          </>
        ) : (
          <View className="h-16 justify-center items-center">
            <Text className="text-secondary-text text-lg">
              Seleccionar escuela
            </Text>
          </View>
        )}
      </Pressable>
      <SchoolSelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        onClose={closeModal}
        multiple={multiple}
      />
    </View>
  );
}
