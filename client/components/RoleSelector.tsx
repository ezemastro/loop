import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Role from "./cards/Role";
import RoleSelectorModal from "./RoleSelectorModal";

export default function RoleSelector({
  onChange,
}: {
  onChange?: (role: Role) => void;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (role: Role) => {
    onChange?.(role);
    setSelectedRole(role);
    closeModal();
  };

  return (
    <View>
      <Pressable
        onPress={openModal}
        className="bg-white rounded border border-stroke"
      >
        {selectedRole ? (
          <Role role={selectedRole} />
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
