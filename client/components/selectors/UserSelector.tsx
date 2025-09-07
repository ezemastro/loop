import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import User from "../cards/User";
import UserSelectorModal from "../modals/UserSelectorModal";

export default function UserSelector({
  onChange,
  value,
}: {
  onChange?: (user: User) => void;
  value: User | null;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (user: User) => {
    onChange?.(user);
    closeModal();
  };

  return (
    <View>
      <Pressable
        onPress={openModal}
        className="bg-white rounded border border-stroke"
      >
        {value ? (
          <User user={value} />
        ) : (
          <View className="h-16 justify-center items-center">
            <Text className="text-secondary-text text-lg">
              Seleccionar usuario
            </Text>
          </View>
        )}
      </Pressable>
      <UserSelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        onClose={closeModal}
      />
    </View>
  );
}
