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
import CloseModalButton from "../CloseModalButton";
import CustomRefresh from "../CustomRefresh";

type ResourceSelectorModalProps<T, M extends boolean = false> = {
  isVisible: boolean;
  title: string;
  onSelect: (item: M extends true ? T[] : T) => void;
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
  multiple?: M;
};

export default function ResourceSelectorModal<T, M extends boolean = false>({
  multiple = false as M,
  isVisible,
  title,
  onSelect,
  onClose,
  useResource,
  renderItem,
  getItems,
  getTotal,
  filterItems,
}: ResourceSelectorModalProps<T, M>) {
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
      onSelect(item as M extends true ? never : T);
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
        <CloseModalButton onClose={onClose} />
        <TextTitle>{title}</TextTitle>
        <SearchBar
          onChange={handleChangeSearch}
          onDebounce={handleDebouncedSearch}
          onSubmit={handleDebouncedSearch}
        />
        <View className="flex-1 justify-center items-center">
          <FlatList
            data={filteredItems}
            className="w-full"
            refreshControl={<CustomRefresh />}
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
            ListEmptyComponent={() => (
              <View className="justify-center items-center mt-10">
                {isError && (
                  <Error>Error al cargar {title.toLowerCase()}</Error>
                )}
                {isLoading && <Loader />}
                {filteredItems.length === 0 && !isLoading && !isError && (
                  <TextInfo>No se encontraron resultados</TextInfo>
                )}
              </View>
            )}
          />
        </View>
        {multiple && (
          <CustomButton
            className="bg-tertiary rounded p-3"
            onPress={() =>
              onSelect(selectedItems as M extends true ? T[] : never)
            }
            disabled={selectedItems.length === 0}
          >
            <ButtonText>Seleccionar</ButtonText>
          </CustomButton>
        )}
      </View>
    </CustomModal>
  );
}
