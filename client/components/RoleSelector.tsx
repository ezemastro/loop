import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Role from "./cards/Role";
import RoleSelectorModal from "./RoleSelectorModal";

export default function RoleSelector({
  onChange,
  value,
}: {
  onChange?: (role: Role) => void;
  value: Role | null;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (role: Role) => {
    onChange?.(role);
    closeModal();
  };

  return (
    <View>
      <Pressable
        onPress={openModal}
        className="bg-white rounded border border-stroke"
      >
        {value ? (
          <Role role={value} />
        ) : (
          <View className="h-14 justify-center items-center">
            <Text className="text-secondary-text text-lg">Seleccionar rol</Text>
          </View>
        )}
      </Pressable>
      <RoleSelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        onClose={closeModal}
      />
    </View>
  );
}
