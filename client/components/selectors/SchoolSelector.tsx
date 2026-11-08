import { useState } from "react";
import { View, Text } from "react-native";
import SchoolSelectorModal from "../modals/SchoolSelectorModal";
import { ControlTrigger } from "../bases/Field";

type SchoolSelectorCommonProps = {
  /**
   * Comunidad por la que filtrar los colegios. `undefined` deja que mande la sesión; `null` es
   * "todavía no sabemos cuál", y en ese caso el selector queda deshabilitado.
   */
  communityId?: UUID | null;
  /** Texto a mostrar mientras el selector está deshabilitado. */
  disabledText?: string;
};

type SchoolSelectorSingleProps = SchoolSelectorCommonProps & {
  multiple?: false;
  value: School | null;
  onChange?: (school: School) => void;
};

type SchoolSelectorMultipleProps = SchoolSelectorCommonProps & {
  multiple: true;
  value: School[];
  onChange?: (schools: School[]) => void;
};

type SchoolSelectorProps = SchoolSelectorSingleProps | SchoolSelectorMultipleProps;

export default function SchoolSelector({
  onChange,
  value,
  multiple = false,
  communityId,
  disabledText,
}: SchoolSelectorProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const isDisabled = communityId === null;

  const openModal = () => {
    if (isDisabled) return;
    setIsModalVisible(true);
  };
  const closeModal = () => {
    setIsModalVisible(false);
  };
  const handleSelect = (selected: School | School[]) => {
    onChange?.(selected as any);
    closeModal();
  };

  const hasValue = value !== null && (!Array.isArray(value) || value.length > 0);

  const schools = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <View>
      <ControlTrigger
        onPress={openModal}
        disabled={isDisabled}
        placeholder={isDisabled ? (disabledText ?? "Elegí una escuela") : "Elegí una escuela"}
      >
        {hasValue ? (
          <View className="gap-1">
            {schools.map((school) => (
              <Text key={school.id} className="text-left text-base text-main-text">
                {school.name}
              </Text>
            ))}
          </View>
        ) : undefined}
      </ControlTrigger>
      <SchoolSelectorModal
        isVisible={isModalVisible}
        onSelect={handleSelect}
        onClose={closeModal}
        multiple={multiple}
        communityId={communityId}
      />
    </View>
  );
}
