import { FlatList, Text, View } from "react-native";
import CustomModal from "../bases/CustomModal";
import type { FiltersValue } from "../ListingSearchFilters";
import { useEffect, useState } from "react";
import SchoolSelector from "../selectors/SchoolSelector";
import CategorySelector from "../selectors/CategorySelector";
import TextTitle from "../bases/TextTitle";
import CustomButton from "../bases/CustomButton";

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
  const [selectedFilters, setSelectedFilters] =
    useState<FiltersValue>(defaultValues);
  useEffect(() => {
    if (isVisible) {
      setSelectedFilters(defaultValues);
    }
  }, [isVisible, defaultValues]);
  const fields = [
    {
      key: "school",
      label: "Escuela",
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
  ];
  return (
    <CustomModal handleClose={onClose} isVisible={isVisible}>
      <View className="bg-background h-3/4 rounded-lg w-full">
        <FlatList
          data={fields}
          className="p-6"
          contentContainerClassName="gap-6"
          renderItem={({ item }) => (
            <View key={item.key}>
              <Text className="text-main-text text-xl">{item.label}</Text>
              {item.selector()}
            </View>
          )}
          ListHeaderComponent={() => (
            <TextTitle className="mb-4">Filtros</TextTitle>
          )}
          ListFooterComponent={
            <CustomButton
              onPress={() => onSelect(selectedFilters)}
              className="mt-4"
            >
              Aplicar
            </CustomButton>
          }
        />
      </View>
    </CustomModal>
  );
}
