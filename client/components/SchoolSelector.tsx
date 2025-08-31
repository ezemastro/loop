import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import SchoolSelectorModal from "./SchoolSelectorModal";

export default function SchoolSelector({
  onChange,
}: {
  onChange?: (school: School) => void;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  const openModal = () => {
    setIsModalVisible(true);
  };

  const handleSelect = (school: School) => {
    onChange?.(school);
    setSelectedSchool(school);
    close();
  };
  return (
    <View>
      <Pressable onPress={openModal} className="bg-white rounded p-3 flex-row">
        {selectedSchool ? (
          <Text>{selectedSchool.name}</Text>
        ) : (
          <Text className="text-gray-500">Seleccionar escuela</Text>
        )}
      </Pressable>
      <SchoolSelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        close={() => setIsModalVisible(false)}
      />
    </View>
  );
}
