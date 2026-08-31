import { FlatList, Pressable, Text, View } from "react-native";
import CustomModal from "../bases/CustomModal";
import type { FiltersValue } from "../ListingSearchFilters";
import { useEffect, useState } from "react";
import SchoolSelector from "../selectors/SchoolSelector";
import CategorySelector from "../selectors/CategorySelector";
import TextTitle from "../bases/TextTitle";
import CustomButton from "../bases/CustomButton";
import { CrossIcon } from "../Icons";
import ProductStatusSelector from "../selectors/ProductStatusSelector";
import UserSelector from "../selectors/UserSelector";
import ButtonText from "../bases/ButtonText";

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
        <View
          className="overflow-hidden bg-background rounded-lg w-full p-6 gap-4"
          style={{ maxHeight: modalMaxHeight }}
        >
          <TextTitle>Filtros</TextTitle>
          <FlatList
            className="flex-1 min-h-0"
            data={fields}
            contentContainerClassName="gap-6"
            renderItem={({ item }) => (
              <View key={item.key} className="gap-2">
                <Text className="text-main-text text-xl">{item.label}</Text>
                <View className="flex-row">
                  <View className="flex-1">{item.selector()}</View>
                  {item.isSelected && (
                    <Pressable
                      className="justify-center ml-4"
                      onPress={() => {
                        setSelectedFilters((prev) => ({
                          ...prev,
                          [item.key]: null,
                        }));
                      }}
                    >
                      <CrossIcon className="text-main-text" />
                    </Pressable>
                  )}
                </View>
              </View>
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
