import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import SchoolSelectorModal from "../modals/SchoolSelectorModal";
import School from "../cards/School";

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

  return (
    <View>
      <Pressable
        onPress={openModal}
        disabled={isDisabled}
        className={
          "rounded border border-stroke gap-0.5 " +
          (isDisabled ? "bg-stroke/40 opacity-60 " : "") +
          (Array.isArray(value) ? (value?.length && value.length > 0 ? "" : "bg-white") : "")
        }
      >
        {/* Si es null o array con 0 elementos */}
        {hasValue ? (
          <>
            {Array.isArray(value) ? (
              value.map((school) => <School key={school.id} school={school} />)
            ) : (
              <School key={value.id} school={value} />
            )}
          </>
        ) : (
          <View className="h-16 justify-center items-center px-3">
            <Text className="text-secondary-text text-center text-base">
              {isDisabled ? (disabledText ?? "Seleccionar escuela") : "Seleccionar escuela"}
            </Text>
          </View>
        )}
      </Pressable>
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
