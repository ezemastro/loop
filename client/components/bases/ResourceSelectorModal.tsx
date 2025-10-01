import { View, Pressable, FlatList } from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import CustomModal from "../bases/CustomModal";
import SearchBar from "../SearchBar";
import Error from "../Error";
import Loader from "../Loader";
import TextInfo from "../bases/TextInfo";
import TextTitle from "./TextTitle";
import CustomButton from "./CustomButton";
import ButtonText from "./ButtonText";

type ResourceSelectorModalProps<T> = {
  isVisible: boolean;
  title: string;
  onSelect: (item: T | T[]) => void;
  onClose: () => void;
  useResource: (params: { searchTerm: string }) => {
    data: any;
    isLoading: boolean;
    isError: boolean;
    fetchNextPage: () => void;
  };
  renderItem: (item: T, options?: { isSelected?: boolean }) => React.ReactNode;
  getItems: (data: any) => T[];
  getTotal: (data: any) => number | undefined;
  filterItems: (items: T[], searchTerm: string) => T[];
  multiple?: boolean;
};

export default function ResourceSelectorModal<T>({
  multiple = false,
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

  const [selectedItems, setSelectedItems] = useState<T[]>([]);
  const handleSelect = (item: T) => {
    if (!multiple) {
      onSelect(item);
      onClose();
      return;
    }
    const isSelected = selectedItems.includes(item);
    if (isSelected) {
      const newSelectedItems = selectedItems.filter((i) => i !== item);
      setSelectedItems(newSelectedItems);
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };
  return (
    <CustomModal isVisible={isVisible} handleClose={onClose}>
      <View className="bg-background rounded p-4 py-6 w-full h-3/4 gap-5">
        <TextTitle>{title}</TextTitle>
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
                <Pressable onPress={() => handleSelect(item)}>
                  {renderItem(item, {
                    isSelected: selectedItems.includes(item),
                  })}
                </Pressable>
              )}
            />
          )}
        </View>
        {multiple && (
          <CustomButton
            className="bg-tertiary rounded p-3"
            onPress={() => onSelect(selectedItems)}
            disabled={selectedItems.length === 0}
          >
            <ButtonText>Seleccionar</ButtonText>
          </CustomButton>
        )}
      </View>
    </CustomModal>
  );
}
