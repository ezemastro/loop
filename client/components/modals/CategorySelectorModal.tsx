import Category from "../cards/Category";
import CustomModal from "../bases/CustomModal";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useCategories } from "@/hooks/useCategories";
import SearchBar from "../SearchBar";
import { useEffect, useState } from "react";
import Loader from "../Loader";
import { BackIcon } from "../Icons";
import TextTitle from "../bases/TextTitle";

export default function CategorySelectorModal({
  isVisible,
  onClose,
  onSelect,
}: {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (category: Category) => void;
}) {
  const { data, isLoading } = useCategories();
  const categories = data?.categories || [];
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<
    Category[] | null
  >(null);
  useEffect(() => {
    if (!isVisible) {
      setSelectedCategories(null);
      setSearchTerm("");
    }
  }, [isVisible]);

  const handleSelect = (category: Category) => {
    if (category.children && category.children.length > 0) {
      setSelectedCategories((categories) => [...(categories || []), category]);
    } else {
      onSelect(category);
    }
  };
  return (
    <CustomModal handleClose={onClose} isVisible={isVisible}>
      <View className="bg-background rounded p-4 py-8 w-full h-3/4 gap-5">
        <TextTitle>Seleccionar categoría</TextTitle>
        <SearchBar onChange={(text) => setSearchTerm(text)} />
        <FlatList
          data={(selectedCategories && selectedCategories.length > 0
            ? selectedCategories[selectedCategories.length - 1].children
            : categories
          )?.filter((category) =>
            category.name.toLowerCase().includes(searchTerm.toLowerCase()),
          )}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => (
            <Pressable
              className="rounded border border-stroke bg-white"
              onPress={() => handleSelect(item)}
            >
              <Category category={item} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="h-40 justify-center items-center">
              {isLoading && <Loader />}
              {!isLoading && (
                <Text className="text-secondary-text text-center">
                  No se encontraron categorías
                </Text>
              )}
            </View>
          }
          ListHeaderComponent={
            selectedCategories && (
              <View className="flex-row items-center gap-4 mb-4">
                <Pressable>
                  <BackIcon
                    className="text-main-text"
                    onPress={() =>
                      setSelectedCategories((categories) =>
                        categories && categories.length > 0
                          ? categories.slice(0, -1)
                          : null,
                      )
                    }
                  />
                </Pressable>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text className="text-xl text-main-text text-center">
                    {selectedCategories
                      .map((category) => category.name)
                      .join("/")}
                  </Text>
                </ScrollView>
              </View>
            )
          }
        />
      </View>
    </CustomModal>
  );
}
