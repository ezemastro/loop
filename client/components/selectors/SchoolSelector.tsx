import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import SchoolSelectorModal from "../modals/SchoolSelectorModal";
import School from "../cards/School";

type SchoolSelectorSingleProps = {
  multiple?: false;
  value: School | null;
  onChange?: (school: School) => void;
};

type SchoolSelectorMultipleProps = {
  multiple: true;
  value: School[];
  onChange?: (schools: School[]) => void;
};

type SchoolSelectorProps =
  | SchoolSelectorSingleProps
  | SchoolSelectorMultipleProps;

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
  const handleSelect = (selected: School | School[]) => {
    onChange?.(selected as any);
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
        {/* Si es null o array con 0 elementos */}
        {value !== null && (!Array.isArray(value) || value.length > 0) ? (
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
