import { View, Text, Pressable, FlatList } from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import CustomModal from "../bases/CustomModal";
import SearchBar from "../SearchBar";
import Error from "../Error";
import Loader from "../Loader";
import TextInfo from "../bases/TextInfo";

type ResourceSelectorModalProps<T> = {
  isVisible: boolean;
  title: string;
  onSelect: (item: T) => void;
  onClose: () => void;
  useResource: (params: { searchTerm: string }) => {
    data: any;
    isLoading: boolean;
    isError: boolean;
    fetchNextPage: () => void;
  };
  renderItem: (item: T) => React.ReactNode;
  getItems: (data: any) => T[];
  getTotal: (data: any) => number | undefined;
  filterItems: (items: T[], searchTerm: string) => T[];
};

export default function ResourceSelectorModal<T>({
  isVisible,
  title,
  onSelect,
  onClose,
  useResource,
  renderItem,
  getItems,
  getTotal,
  filterItems,
}: ResourceSelectorModalProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading, isError, fetchNextPage } = useResource({
    searchTerm,
  });

  const items = useMemo(() => getItems(data), [data, getItems]);
  const totalData = getTotal(data);

  const [filteredItems, setFilteredItems] = useState(items);

  useEffect(() => {
    setFilteredItems(items);
  }, [items]);

  const handleChangeSearch = (text: string) => {
    if (totalData && items.length >= totalData) {
      setFilteredItems(filterItems(items, text));
    }
  };

  const handleDebouncedSearch = (text: string) => {
    if (totalData && items.length < totalData) setSearchTerm(text);
  };

  return (
    <CustomModal isVisible={isVisible} handleClose={onClose}>
      <View className="bg-background rounded p-4 py-6 w-full h-3/4 gap-5">
        <Text className="text-center text-2xl text-main-text">{title}</Text>
        <SearchBar
          onChange={handleChangeSearch}
          onDebounce={handleDebouncedSearch}
          onSubmit={handleDebouncedSearch}
        />
        <View className="flex-1 justify-center items-center">
          {isError && <Error>Error al cargar {title.toLowerCase()}</Error>}
          {isLoading && <Loader />}
          {filteredItems.length === 0 && !isLoading && !isError && (
            <TextInfo>No se encontraron resultados</TextInfo>
          )}
          {filteredItems.length > 0 && !isLoading && !isError && (
            <FlatList
              data={filteredItems}
              className="w-full"
              contentContainerClassName="gap-3"
              onEndReached={() => fetchNextPage()}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => (
                <Pressable onPress={() => onSelect(item)}>
                  {renderItem(item)}
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </CustomModal>
  );
}
