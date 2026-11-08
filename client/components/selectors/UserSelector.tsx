import { useState } from "react";
import { View } from "react-native";
import UserSelectorModal from "../modals/UserSelectorModal";
import { ControlTrigger } from "../bases/Field";

export default function UserSelector({
  onChange,
  value,
  invalid,
}: {
  onChange?: (user: PublicUser) => void;
  value: PublicUser | null;
  invalid?: boolean;
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (user: PublicUser) => {
    onChange?.(user);
    closeModal();
  };
  return (
    <View>
      <ControlTrigger
        onPress={openModal}
        invalid={invalid}
        placeholder="Elegí un usuario"
        value={value ? `${value.firstName} ${value.lastName}` : null}
      />
      <UserSelectorModal isVisible={isModalVisible} onSelect={handleSelect} onClose={closeModal} />
    </View>
  );
}
