import { FlatList, Pressable, Text, View } from "react-native";
import CustomModal from "../bases/CustomModal";
import type { FiltersValue } from "../ListingSearchFilters";
import { useEffect, useState } from "react";
import SchoolSelector from "../selectors/SchoolSelector";
import CategorySelector from "../selectors/CategorySelector";
import ModalHeader, { modalSurfaceClassName } from "../bases/ModalHeader";
import CustomButton from "../bases/CustomButton";
import { CrossIcon } from "../Icons";
import ProductStatusSelector from "../selectors/ProductStatusSelector";
import UserSelector from "../selectors/UserSelector";
import ButtonText from "../bases/ButtonText";
import { Field } from "../bases/Field";

export default function ListingSearchFiltersModal({
  onClose,
  isVisible,
  defaultValues,
  onSelect,
}: {
  onClose: () => void;
  isVisible: boolean;
  defaultValues: FiltersValue;
  onSelect: (filters: FiltersValue) => void;
}) {
  const [selectedFilters, setSelectedFilters] = useState<FiltersValue>(defaultValues);
  useEffect(() => {
    if (isVisible) {
      setSelectedFilters(defaultValues);
    }
  }, [isVisible, defaultValues]);
  const fields = [
    {
      key: "school",
      label: "Escuela",
      isSelected: !!selectedFilters.school,
      selector: () => (
        <SchoolSelector
          onChange={(selectedSchool) =>
            setSelectedFilters({ ...selectedFilters, school: selectedSchool })
          }
          value={selectedFilters.school}
        />
      ),
    },
    {
      key: "category",
      label: "Categoría",
      isSelected: !!selectedFilters.category,
      selector: () => (
        <CategorySelector
          onChange={(selectedCategory) =>
            setSelectedFilters({
              ...selectedFilters,
              category: selectedCategory,
            })
          }
          value={selectedFilters.category}
        />
      ),
    },
    {
      key: "productStatus",
      label: "Condición",
      isSelected: !!selectedFilters.productStatus,
      selector: () => (
        <ProductStatusSelector
          onChange={(selectedProductStatus) =>
            setSelectedFilters({
              ...selectedFilters,
              productStatus: selectedProductStatus,
            })
          }
          value={selectedFilters.productStatus}
        />
      ),
    },
    {
      key: "user",
      label: "Vendedor",
      isSelected: !!selectedFilters.user,
      selector: () => (
        <UserSelector
          onChange={(selectedUser) =>
            setSelectedFilters({ ...selectedFilters, user: selectedUser })
          }
          value={selectedFilters.user}
        />
      ),
    },
  ];
  return (
    <CustomModal handleClose={onClose} isVisible={isVisible}>
      {(modalMaxHeight) => (
        <View className={modalSurfaceClassName()} style={{ maxHeight: modalMaxHeight }}>
          <ModalHeader title="Filtros" onClose={onClose} />
          <FlatList
            className="flex-1 min-h-0"
            data={fields}
            contentContainerClassName="gap-4"
            renderItem={({ item }) => (
              <Field key={item.key} label={item.label}>
                <View className="flex-row items-center">
                  <View className="flex-1">{item.selector()}</View>
                  {item.isSelected && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar filtro de ${item.label.toLowerCase()}`}
                      className="ml-2 h-11 w-11 items-center justify-center rounded-full hover:bg-background"
                      onPress={() => {
                        setSelectedFilters((prev) => ({
                          ...prev,
                          [item.key]: null,
                        }));
                      }}
                    >
                      <CrossIcon size={20} className="text-main-text" />
                    </Pressable>
                  )}
                </View>
              </Field>
            )}
          />
          <CustomButton onPress={() => onSelect(selectedFilters)}>
            <ButtonText>Aplicar</ButtonText>
          </CustomButton>
        </View>
      )}
    </CustomModal>
  );
}
