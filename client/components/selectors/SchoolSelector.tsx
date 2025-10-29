import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import SchoolSelectorModal from "../modals/SchoolSelectorModal";
import School from "../cards/School";

type SchoolSelectorProps<M extends boolean = false> = {
  multiple?: M;
  value: M extends true ? School[] : School | null;
  onChange?: (schools: M extends true ? School[] : School) => void;
};

export default function SchoolSelector({
  onChange,
  value,
  multiple = false,
}: SchoolSelectorProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (selected: SchoolSelectorProps["value"]) => {
    onChange?.(selected!);
    closeModal();
  };

  return (
    <View>
      <Pressable
        onPress={openModal}
        className={
          "rounded border border-stroke gap-0.5 " +
          (Array.isArray(value)
            ? value?.length && value.length > 0
              ? ""
              : "bg-white"
            : "")
        }
      >
        {value ? (
          <>
            {Array.isArray(value) ? (
              value.map((school) => <School key={school.id} school={school} />)
            ) : (
              <School key={value.id} school={value} />
            )}
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
